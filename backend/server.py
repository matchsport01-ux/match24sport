from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'match_sport_24_secret_key')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Create the main app
app = FastAPI(title="Match Sport 24 API")

# Socket.IO setup for real-time chat
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ======================= MODELS =======================

# Sports enum
SPORTS = ["padel", "tennis", "calcetto", "calcio8"]
MATCH_FORMATS = {
    "padel": {"min_players": 4, "max_players": 4},
    "tennis_singles": {"min_players": 2, "max_players": 2},
    "tennis_doubles": {"min_players": 4, "max_players": 4},
    "calcetto": {"min_players": 10, "max_players": 12},
    "calcio8": {"min_players": 16, "max_players": 18}
}

# User roles
ROLES = ["player", "club_admin", "super_admin"]

# Subscription plans
SUBSCRIPTION_PLANS = {
    "monthly": {"name": "Mensile", "price": 49.99, "duration_days": 30},
    "yearly": {"name": "Annuale", "price": 399.99, "duration_days": 365}
}

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "player"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# Player Profile Models
class PlayerProfileCreate(BaseModel):
    nickname: Optional[str] = None
    city: str
    preferred_sports: List[str] = []
    bio: Optional[str] = None
    profile_picture: Optional[str] = None

class PlayerProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    city: Optional[str] = None
    preferred_sports: Optional[List[str]] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    skill_levels: Optional[Dict[str, str]] = None

# Club Models
class ClubCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    logo: Optional[str] = None
    photos: List[str] = []

class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    logo: Optional[str] = None
    photos: Optional[List[str]] = None

# Court Models
class CourtCreate(BaseModel):
    name: str
    sport: str
    available_hours: List[str] = []  # e.g., ["09:00-10:00", "10:00-11:00"]
    notes: Optional[str] = None
    is_active: bool = True

class CourtUpdate(BaseModel):
    name: Optional[str] = None
    sport: Optional[str] = None
    available_hours: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

# Match Models
class MatchCreate(BaseModel):
    sport: str
    format: str  # e.g., "padel", "tennis_singles", "tennis_doubles", "calcetto"
    court_id: str
    date: str  # ISO format date
    start_time: str  # e.g., "10:00"
    end_time: str  # e.g., "11:00"
    max_players: int
    skill_level: str = "all"  # "beginner", "intermediate", "advanced", "all"
    price_per_player: float = 0.0
    notes: Optional[str] = None

class MatchUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    skill_level: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

# Match Result Models
class MatchResultSubmit(BaseModel):
    score_team_a: str  # e.g., "6-4, 7-5" or "3"
    score_team_b: str
    winner_team: str  # "A" or "B" or "draw"
    team_a_players: List[str]  # user_ids
    team_b_players: List[str]  # user_ids

# Chat Models
class ChatMessage(BaseModel):
    content: str

# Notification Models
class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str  # "booking", "match_full", "result", "chat", "subscription"

# ======================= HELPER FUNCTIONS =======================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_current_user(request: Request) -> dict:
    # Check cookie first
    token = request.cookies.get("session_token")
    
    # Then check Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if it's a session token (from Google OAuth)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    
    # Try JWT token
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

def calculate_elo_change(player_rating: int, opponent_rating: int, result: float, k: int = 32) -> int:
    """Calculate Elo rating change. result: 1 for win, 0.5 for draw, 0 for loss"""
    expected = 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))
    return int(k * (result - expected))

# ======================= AUTH ENDPOINTS =======================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = get_password_hash(user_data.password)
    
    user = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hashed_password,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_active": True,
        "language": "it"
    }
    
    await db.users.insert_one(user)
    
    # Create player profile if player role
    if user_data.role == "player":
        player_profile = {
            "user_id": user_id,
            "nickname": user_data.name,
            "city": "",
            "preferred_sports": [],
            "bio": "",
            "profile_picture": None,
            "skill_levels": {"padel": "beginner", "tennis": "beginner", "calcetto": "beginner", "calcio8": "beginner"},
            "created_at": datetime.now(timezone.utc)
        }
        await db.player_profiles.insert_one(player_profile)
        
        # Initialize ratings
        for sport in SPORTS:
            rating = {
                "user_id": user_id,
                "sport": sport,
                "rating": 1200,
                "matches_played": 0,
                "wins": 0,
                "losses": 0,
                "draws": 0,
                "updated_at": datetime.now(timezone.utc)
            }
            await db.player_ratings.insert_one(rating)
    
    access_token = create_access_token(data={"sub": user_id})
    
    user_response = {k: v for k, v in user.items() if k != "password_hash" and k != "_id"}
    
    return TokenResponse(access_token=access_token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["user_id"]})
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return TokenResponse(access_token=access_token, user=user_response)

@api_router.post("/auth/google/session")
async def google_auth_session(request: Request):
    """Exchange session_id from Google OAuth for session token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        auth_data = response.json()
    
    # Check if user exists
    user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if not user:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "role": "player",  # Default role for Google OAuth
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True,
            "language": "it",
            "auth_provider": "google"
        }
        await db.users.insert_one(user)
        
        # Create player profile
        player_profile = {
            "user_id": user_id,
            "nickname": auth_data["name"],
            "city": "",
            "preferred_sports": [],
            "bio": "",
            "profile_picture": auth_data.get("picture"),
            "skill_levels": {"padel": "beginner", "tennis": "beginner", "calcetto": "beginner"},
            "created_at": datetime.now(timezone.utc)
        }
        await db.player_profiles.insert_one(player_profile)
        
        # Initialize ratings
        for sport in SPORTS:
            rating = {
                "user_id": user_id,
                "sport": sport,
                "rating": 1200,
                "matches_played": 0,
                "wins": 0,
                "losses": 0,
                "draws": 0,
                "updated_at": datetime.now(timezone.utc)
            }
            await db.player_ratings.insert_one(rating)
    else:
        user_id = user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"picture": auth_data.get("picture"), "updated_at": datetime.now(timezone.utc)}}
        )
    
    # Create session
    session_token = auth_data.get("session_token", f"session_{uuid.uuid4().hex}")
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session)
    
    # Get updated user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    response = JSONResponse(content={"user": user_response, "session_token": session_token})
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return response

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}

@api_router.post("/auth/logout")
async def logout(request: Request):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(key="session_token", path="/")
    return response

# ======================= PLAYER PROFILE ENDPOINTS =======================

@api_router.get("/player/profile")
async def get_player_profile(user: dict = Depends(get_current_user)):
    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@api_router.put("/player/profile")
async def update_player_profile(profile_data: PlayerProfileUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.player_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        # Create profile if it doesn't exist
        profile = {
            "user_id": user["user_id"],
            **update_data,
            "created_at": datetime.now(timezone.utc)
        }
        await db.player_profiles.insert_one(profile)
    
    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return profile

@api_router.get("/player/ratings")
async def get_player_ratings(user: dict = Depends(get_current_user)):
    ratings = await db.player_ratings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10)
    return ratings

@api_router.get("/player/ratings/{user_id}")
async def get_user_ratings(user_id: str):
    ratings = await db.player_ratings.find({"user_id": user_id}, {"_id": 0}).to_list(10)
    if not ratings:
        raise HTTPException(status_code=404, detail="Ratings not found")
    return ratings

@api_router.get("/player/stats")
async def get_player_stats(user: dict = Depends(get_current_user)):
    ratings = await db.player_ratings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10)
    
    total_matches = sum(r.get("matches_played", 0) for r in ratings)
    total_wins = sum(r.get("wins", 0) for r in ratings)
    total_losses = sum(r.get("losses", 0) for r in ratings)
    total_draws = sum(r.get("draws", 0) for r in ratings)
    
    return {
        "total_matches": total_matches,
        "total_wins": total_wins,
        "total_losses": total_losses,
        "total_draws": total_draws,
        "ratings_by_sport": ratings
    }

@api_router.get("/player/history")
async def get_player_match_history(
    user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    # Get all matches where user participated
    participations = await db.match_participants.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    match_ids = [p["match_id"] for p in participations]
    
    matches = await db.matches.find(
        {"match_id": {"$in": match_ids}},
        {"_id": 0}
    ).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with results
    for match in matches:
        result = await db.match_results.find_one({"match_id": match["match_id"]}, {"_id": 0})
        match["result"] = result
    
    return matches

# ======================= CLUB ENDPOINTS =======================

@api_router.post("/club/register")
async def register_club(club_data: ClubCreate, user: dict = Depends(get_current_user)):
    # Check if user already has a club
    existing = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="User already has a club")
    
    club_id = f"club_{uuid.uuid4().hex[:12]}"
    
    club = {
        "club_id": club_id,
        "admin_user_id": user["user_id"],
        **club_data.dict(),
        "is_active": True,
        "subscription_status": "trial",
        "subscription_plan": "trial_3m",
        "subscription_expires_at": datetime.now(timezone.utc) + timedelta(days=90),  # 3-month trial
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.clubs.insert_one(club)
    
    # Update user role to club_admin
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"role": "club_admin", "club_id": club_id}}
    )
    
    return {k: v for k, v in club.items() if k != "_id"}

@api_router.get("/club/my")
async def get_my_club(user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club

@api_router.put("/club/my")
async def update_my_club(club_data: ClubUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in club_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.clubs.update_one(
        {"admin_user_id": user["user_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")
    
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]}, {"_id": 0})
    return club

@api_router.get("/clubs")
async def list_clubs(
    city: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    query = {"is_active": True}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    clubs = await db.clubs.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # If sport filter, filter clubs that have courts for that sport
    if sport:
        filtered_clubs = []
        for club in clubs:
            courts = await db.courts.find(
                {"club_id": club["club_id"], "sport": sport, "is_active": True}
            ).to_list(1)
            if courts:
                filtered_clubs.append(club)
        clubs = filtered_clubs
    
    return clubs

@api_router.get("/clubs/{club_id}")
async def get_club(club_id: str):
    club = await db.clubs.find_one({"club_id": club_id}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    
    # Get courts
    courts = await db.courts.find({"club_id": club_id, "is_active": True}, {"_id": 0}).to_list(100)
    club["courts"] = courts
    
    return club

# ======================= COURT ENDPOINTS =======================

@api_router.post("/club/courts")
async def create_court(court_data: CourtCreate, user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    court_id = f"court_{uuid.uuid4().hex[:12]}"
    
    court = {
        "court_id": court_id,
        "club_id": club["club_id"],
        **court_data.dict(),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.courts.insert_one(court)
    return {k: v for k, v in court.items() if k != "_id"}

@api_router.get("/club/courts")
async def get_club_courts(user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    courts = await db.courts.find({"club_id": club["club_id"]}, {"_id": 0}).to_list(100)
    return courts

@api_router.put("/club/courts/{court_id}")
async def update_court(court_id: str, court_data: CourtUpdate, user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    update_data = {k: v for k, v in court_data.dict().items() if v is not None}
    
    result = await db.courts.update_one(
        {"court_id": court_id, "club_id": club["club_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Court not found")
    
    court = await db.courts.find_one({"court_id": court_id}, {"_id": 0})
    return court

@api_router.delete("/club/courts/{court_id}")
async def delete_court(court_id: str, user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    result = await db.courts.update_one(
        {"court_id": court_id, "club_id": club["club_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Court not found")
    
    return {"message": "Court deactivated"}

# ======================= FAVORITE CLUBS ENDPOINTS =======================

@api_router.get("/player/favorite-clubs")
async def get_favorite_clubs(user: dict = Depends(get_current_user)):
    """Get player's favorite clubs"""
    favorites = await db.favorite_clubs.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    club_ids = [f["club_id"] for f in favorites]
    
    if not club_ids:
        return []
    
    clubs = await db.clubs.find({"club_id": {"$in": club_ids}}, {"_id": 0}).to_list(100)
    return clubs

@api_router.post("/player/favorite-clubs/{club_id}")
async def add_favorite_club(club_id: str, user: dict = Depends(get_current_user)):
    """Add a club to favorites"""
    # Check if club exists
    club = await db.clubs.find_one({"club_id": club_id})
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    
    # Check if already in favorites
    existing = await db.favorite_clubs.find_one({"user_id": user["user_id"], "club_id": club_id})
    if existing:
        return {"message": "Already in favorites", "is_favorite": True}
    
    # Add to favorites
    await db.favorite_clubs.insert_one({
        "user_id": user["user_id"],
        "club_id": club_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Added to favorites", "is_favorite": True}

@api_router.delete("/player/favorite-clubs/{club_id}")
async def remove_favorite_club(club_id: str, user: dict = Depends(get_current_user)):
    """Remove a club from favorites"""
    result = await db.favorite_clubs.delete_one({"user_id": user["user_id"], "club_id": club_id})
    
    if result.deleted_count == 0:
        return {"message": "Not in favorites", "is_favorite": False}
    
    return {"message": "Removed from favorites", "is_favorite": False}

@api_router.get("/player/favorite-clubs/{club_id}/status")
async def check_favorite_status(club_id: str, user: dict = Depends(get_current_user)):
    """Check if a club is in favorites"""
    existing = await db.favorite_clubs.find_one({"user_id": user["user_id"], "club_id": club_id})
    return {"is_favorite": existing is not None}

# ======================= MATCH ENDPOINTS =======================

@api_router.post("/matches")
async def create_match(match_data: MatchCreate, user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    # Verify court belongs to club
    court = await db.courts.find_one({"court_id": match_data.court_id, "club_id": club["club_id"]})
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    match_id = f"match_{uuid.uuid4().hex[:12]}"
    
    match = {
        "match_id": match_id,
        "club_id": club["club_id"],
        "club_name": club["name"],
        "club_city": club["city"],
        **match_data.dict(),
        "court_name": court["name"],
        "current_players": 0,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.matches.insert_one(match)
    return {k: v for k, v in match.items() if k != "_id"}

@api_router.get("/matches")
async def list_matches(
    city: Optional[str] = None,
    sport: Optional[str] = None,
    date: Optional[str] = None,
    skill_level: Optional[str] = None,
    club_id: Optional[str] = None,
    status: str = "open",
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    query = {"status": status}
    
    if city:
        query["club_city"] = {"$regex": city, "$options": "i"}
    if sport:
        query["sport"] = sport
    if date:
        query["date"] = date
    if skill_level and skill_level != "all":
        query["$or"] = [{"skill_level": skill_level}, {"skill_level": "all"}]
    if club_id:
        query["club_id"] = club_id
    
    matches = await db.matches.find(query, {"_id": 0}).sort("date", 1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with participants
    for match in matches:
        participants = await db.match_participants.find(
            {"match_id": match["match_id"]},
            {"_id": 0}
        ).to_list(20)
        match["participants"] = participants
    
    return matches

@api_router.get("/matches/{match_id}")
async def get_match(match_id: str, request: Request):
    match = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get participants with user info
    participants = await db.match_participants.find({"match_id": match_id}, {"_id": 0}).to_list(20)
    for p in participants:
        user = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0, "password_hash": 0})
        profile = await db.player_profiles.find_one({"user_id": p["user_id"]}, {"_id": 0})
        p["user"] = user
        p["profile"] = profile
    
    match["participants"] = participants
    
    # Get result if exists
    result = await db.match_results.find_one({"match_id": match_id}, {"_id": 0})
    match["result"] = result
    
    # Get club info
    club = await db.clubs.find_one({"club_id": match["club_id"]}, {"_id": 0})
    match["club"] = club
    
    return match

@api_router.post("/matches/{match_id}/join")
async def join_match(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"match_id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["status"] != "open":
        raise HTTPException(status_code=400, detail="Match is not open for registration")
    
    if match["current_players"] >= match["max_players"]:
        raise HTTPException(status_code=400, detail="Match is full")
    
    # Check if already joined
    existing = await db.match_participants.find_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already joined this match")
    
    participant = {
        "match_id": match_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "joined_at": datetime.now(timezone.utc),
        "status": "confirmed"
    }
    
    await db.match_participants.insert_one(participant)
    
    # Update match player count
    new_count = match["current_players"] + 1
    new_status = "full" if new_count >= match["max_players"] else "open"
    
    await db.matches.update_one(
        {"match_id": match_id},
        {"$set": {"current_players": new_count, "status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Create notification for user
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": "Prenotazione confermata",
        "message": f"Ti sei iscritto alla partita di {match['sport']} del {match['date']}",
        "type": "booking",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Joined successfully", "current_players": new_count, "status": new_status}

@api_router.post("/matches/{match_id}/leave")
async def leave_match(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"match_id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["status"] == "completed":
        raise HTTPException(status_code=400, detail="Cannot leave a completed match")
    
    result = await db.match_participants.delete_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not a participant of this match")
    
    # Update match player count
    new_count = max(0, match["current_players"] - 1)
    
    await db.matches.update_one(
        {"match_id": match_id},
        {"$set": {"current_players": new_count, "status": "open", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Left successfully", "current_players": new_count}

@api_router.put("/matches/{match_id}")
async def update_match(match_id: str, match_data: MatchUpdate, user: dict = Depends(get_current_user)):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    update_data = {k: v for k, v in match_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.matches.update_one(
        {"match_id": match_id, "club_id": club["club_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    return match

@api_router.get("/club/matches")
async def get_club_matches(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100)
):
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    query = {"club_id": club["club_id"]}
    if status:
        query["status"] = status
    
    matches = await db.matches.find(query, {"_id": 0}).sort("date", 1).limit(limit).to_list(limit)
    
    for match in matches:
        participants = await db.match_participants.find(
            {"match_id": match["match_id"]},
            {"_id": 0}
        ).to_list(20)
        match["participants"] = participants
    
    return matches

@api_router.get("/club/dashboard")
async def get_club_dashboard(user: dict = Depends(get_current_user)):
    # Search for club by admin_user_id regardless of user role
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    # Count courts
    courts_count = await db.courts.count_documents({"club_id": club["club_id"], "is_active": True})
    
    # Count matches by status
    open_matches = await db.matches.count_documents({"club_id": club["club_id"], "status": "open"})
    full_matches = await db.matches.count_documents({"club_id": club["club_id"], "status": "full"})
    completed_matches = await db.matches.count_documents({"club_id": club["club_id"], "status": "completed"})
    
    # Count total bookings
    match_ids = await db.matches.distinct("match_id", {"club_id": club["club_id"]})
    total_bookings = await db.match_participants.count_documents({"match_id": {"$in": match_ids}})
    
    return {
        "club": club,
        "stats": {
            "courts_count": courts_count,
            "open_matches": open_matches,
            "full_matches": full_matches,
            "completed_matches": completed_matches,
            "total_bookings": total_bookings
        }
    }

# ======================= MATCH RESULTS ENDPOINTS =======================

@api_router.post("/matches/{match_id}/result")
async def submit_match_result(match_id: str, result_data: MatchResultSubmit, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"match_id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify user is participant or club admin
    is_participant = await db.match_participants.find_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    
    club = await db.clubs.find_one({"club_id": match["club_id"], "admin_user_id": user["user_id"]})
    
    if not is_participant and not club:
        raise HTTPException(status_code=403, detail="Not authorized to submit result")
    
    # Check if result already exists
    existing_result = await db.match_results.find_one({"match_id": match_id})
    
    result_id = f"result_{uuid.uuid4().hex[:12]}"
    
    result = {
        "result_id": result_id,
        "match_id": match_id,
        "submitted_by": user["user_id"],
        **result_data.dict(),
        "status": "pending_confirmation",
        "confirmations": [user["user_id"]],
        "created_at": datetime.now(timezone.utc)
    }
    
    if existing_result:
        # Update existing result
        await db.match_results.update_one(
            {"match_id": match_id},
            {"$set": result}
        )
    else:
        await db.match_results.insert_one(result)
    
    # Notify other participants
    participants = await db.match_participants.find({"match_id": match_id}).to_list(20)
    for p in participants:
        if p["user_id"] != user["user_id"]:
            notification = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": p["user_id"],
                "title": "Risultato da confermare",
                "message": f"È stato inserito il risultato della partita di {match['sport']}",
                "type": "result",
                "match_id": match_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
    
    return {k: v for k, v in result.items() if k != "_id"}

@api_router.post("/matches/{match_id}/result/confirm")
async def confirm_match_result(match_id: str, user: dict = Depends(get_current_user)):
    # Verify user is participant
    is_participant = await db.match_participants.find_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    result = await db.match_results.find_one({"match_id": match_id})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    if user["user_id"] in result.get("confirmations", []):
        raise HTTPException(status_code=400, detail="Already confirmed")
    
    # Add confirmation
    await db.match_results.update_one(
        {"match_id": match_id},
        {"$push": {"confirmations": user["user_id"]}}
    )
    
    result = await db.match_results.find_one({"match_id": match_id})
    
    # Check if enough confirmations (at least 2 or majority)
    participants = await db.match_participants.find({"match_id": match_id}).to_list(20)
    required_confirmations = min(2, len(participants))
    
    if len(result.get("confirmations", [])) >= required_confirmations:
        # Mark result as confirmed and update ratings
        await db.match_results.update_one(
            {"match_id": match_id},
            {"$set": {"status": "confirmed"}}
        )
        
        await db.matches.update_one(
            {"match_id": match_id},
            {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Update ratings
        match = await db.matches.find_one({"match_id": match_id})
        sport = match["sport"]
        
        winner_team = result["winner_team"]
        team_a_players = result["team_a_players"]
        team_b_players = result["team_b_players"]
        
        # Calculate average ratings for each team
        async def get_team_avg_rating(player_ids):
            total = 0
            for pid in player_ids:
                rating = await db.player_ratings.find_one({"user_id": pid, "sport": sport})
                total += rating.get("rating", 1200) if rating else 1200
            return total / len(player_ids) if player_ids else 1200
        
        team_a_avg = await get_team_avg_rating(team_a_players)
        team_b_avg = await get_team_avg_rating(team_b_players)
        
        # Update ratings for each player
        for player_id in team_a_players:
            current_rating = await db.player_ratings.find_one({"user_id": player_id, "sport": sport})
            if not current_rating:
                continue
            
            if winner_team == "A":
                result_score = 1.0
                win_inc, loss_inc = 1, 0
            elif winner_team == "B":
                result_score = 0.0
                win_inc, loss_inc = 0, 1
            else:
                result_score = 0.5
                win_inc, loss_inc = 0, 0
            
            rating_change = calculate_elo_change(current_rating["rating"], int(team_b_avg), result_score)
            new_rating = current_rating["rating"] + rating_change
            
            await db.player_ratings.update_one(
                {"user_id": player_id, "sport": sport},
                {
                    "$set": {"rating": new_rating, "updated_at": datetime.now(timezone.utc)},
                    "$inc": {"matches_played": 1, "wins": win_inc, "losses": loss_inc}
                }
            )
            
            # Save rating history
            history = {
                "user_id": player_id,
                "sport": sport,
                "match_id": match_id,
                "old_rating": current_rating["rating"],
                "new_rating": new_rating,
                "change": rating_change,
                "created_at": datetime.now(timezone.utc)
            }
            await db.player_rating_history.insert_one(history)
        
        for player_id in team_b_players:
            current_rating = await db.player_ratings.find_one({"user_id": player_id, "sport": sport})
            if not current_rating:
                continue
            
            if winner_team == "B":
                result_score = 1.0
                win_inc, loss_inc = 1, 0
            elif winner_team == "A":
                result_score = 0.0
                win_inc, loss_inc = 0, 1
            else:
                result_score = 0.5
                win_inc, loss_inc = 0, 0
            
            rating_change = calculate_elo_change(current_rating["rating"], int(team_a_avg), result_score)
            new_rating = current_rating["rating"] + rating_change
            
            await db.player_ratings.update_one(
                {"user_id": player_id, "sport": sport},
                {
                    "$set": {"rating": new_rating, "updated_at": datetime.now(timezone.utc)},
                    "$inc": {"matches_played": 1, "wins": win_inc, "losses": loss_inc}
                }
            )
            
            history = {
                "user_id": player_id,
                "sport": sport,
                "match_id": match_id,
                "old_rating": current_rating["rating"],
                "new_rating": new_rating,
                "change": rating_change,
                "created_at": datetime.now(timezone.utc)
            }
            await db.player_rating_history.insert_one(history)
        
        return {"message": "Result confirmed and ratings updated", "status": "confirmed"}
    
    return {"message": "Confirmation added", "confirmations": len(result.get("confirmations", [])) + 1}

# ======================= CHAT ENDPOINTS =======================

@api_router.get("/matches/{match_id}/chat")
async def get_match_chat(match_id: str, user: dict = Depends(get_current_user)):
    # Verify user is participant
    is_participant = await db.match_participants.find_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Check if match is active (not completed more than 24h ago)
    match = await db.matches.find_one({"match_id": match_id})
    if match and match.get("status") == "completed":
        completed_at = match.get("updated_at", datetime.now(timezone.utc))
        if isinstance(completed_at, str):
            completed_at = datetime.fromisoformat(completed_at)
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) - completed_at > timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Chat is no longer available")
    
    messages = await db.chat_messages.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return messages

@api_router.post("/matches/{match_id}/chat")
async def send_chat_message(match_id: str, message: ChatMessage, user: dict = Depends(get_current_user)):
    # Verify user is participant
    is_participant = await db.match_participants.find_one({
        "match_id": match_id,
        "user_id": user["user_id"]
    })
    
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Check if match is active
    match = await db.matches.find_one({"match_id": match_id})
    if match and match.get("status") == "completed":
        completed_at = match.get("updated_at", datetime.now(timezone.utc))
        if isinstance(completed_at, str):
            completed_at = datetime.fromisoformat(completed_at)
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) - completed_at > timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Chat is no longer available")
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    chat_message = {
        "message_id": message_id,
        "match_id": match_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "content": message.content,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.chat_messages.insert_one(chat_message)
    
    # Emit socket event
    await sio.emit(f"chat_{match_id}", {k: v for k, v in chat_message.items() if k != "_id"})
    
    return {k: v for k, v in chat_message.items() if k != "_id"}

# ======================= NOTIFICATIONS ENDPOINTS =======================

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user), limit: int = Query(20, ge=1, le=100)):
    notifications = await db.notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ======================= PROMO CODE ENDPOINTS =======================

class PromoCodeValidate(BaseModel):
    code: str

# Promo code types:
# - trial_months: gives X months free trial
# - percentage: gives X% discount
PROMO_CODES = {
    "TRIAL3MESI": {"type": "trial_months", "value": 3, "description": "3 mesi di prova gratuita"},
    "SCONTO20": {"type": "percentage", "value": 20, "description": "Sconto 20%"},
    "SCONTO50": {"type": "percentage", "value": 50, "description": "Sconto 50%"},
    "WELCOME10": {"type": "percentage", "value": 10, "description": "Sconto di benvenuto 10%"}
}

@api_router.post("/promo/validate")
async def validate_promo_code(data: PromoCodeValidate):
    code = data.code.upper().strip()
    
    if code not in PROMO_CODES:
        return {"valid": False, "message": "Codice promozionale non valido"}
    
    promo = PROMO_CODES[code]
    
    if promo["type"] == "trial_months":
        return {
            "valid": True,
            "code": code,
            "type": "trial_months",
            "value": promo["value"],
            "discount": 100,  # 100% discount for trial
            "message": f"Codice valido! {promo['description']}"
        }
    elif promo["type"] == "percentage":
        return {
            "valid": True,
            "code": code,
            "type": "percentage",
            "value": promo["value"],
            "discount": promo["value"],
            "message": f"Codice valido! {promo['description']}"
        }
    
    return {"valid": False, "message": "Codice non valido"}

@api_router.post("/promo/apply-trial")
async def apply_trial_promo(data: PromoCodeValidate, user: dict = Depends(get_current_user)):
    """Apply a trial promo code directly to the club subscription"""
    code = data.code.upper().strip()
    
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Codice promozionale non valido")
    
    promo = PROMO_CODES[code]
    
    if promo["type"] != "trial_months":
        raise HTTPException(status_code=400, detail="Questo codice non è valido per una prova gratuita")
    
    # Get club
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Non sei un amministratore di un circolo")
    
    # Check if promo was already used by this club
    existing = await db.promo_usage.find_one({"club_id": club["club_id"], "code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Questo codice è già stato utilizzato")
    
    # Apply the trial
    trial_months = promo["value"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=trial_months * 30)
    
    await db.clubs.update_one(
        {"club_id": club["club_id"]},
        {
            "$set": {
                "subscription_status": "trial",
                "subscription_plan": f"trial_{trial_months}m",
                "subscription_expires_at": expires_at,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Record promo usage
    await db.promo_usage.insert_one({
        "club_id": club["club_id"],
        "code": code,
        "used_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "message": f"Prova gratuita di {trial_months} mesi attivata!",
        "expires_at": expires_at.isoformat()
    }

# ======================= SUBSCRIPTION & PAYMENT ENDPOINTS =======================

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    return SUBSCRIPTION_PLANS

@api_router.post("/subscription/checkout")
async def create_subscription_checkout(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    plan_id = body.get("plan_id")
    origin_url = body.get("origin_url")
    
    if plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    
    # Get club
    club = await db.clubs.find_one({"admin_user_id": user["user_id"]})
    if not club:
        raise HTTPException(status_code=403, detail="Not a club admin")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    success_url = f"{origin_url}/club/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/club/subscription"
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=float(plan["price"]),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "club_id": club["club_id"],
            "plan_id": plan_id
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "club_id": club["club_id"],
        "plan_id": plan_id,
        "amount": plan["price"],
        "currency": "eur",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc)
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/subscription/status/{session_id}")
async def get_subscription_status(session_id: str, user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    host_url = "https://example.com"  # Not needed for status check
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
            )
            
            # Update club subscription
            plan_id = transaction.get("plan_id")
            if plan_id in SUBSCRIPTION_PLANS:
                plan = SUBSCRIPTION_PLANS[plan_id]
                expires_at = datetime.now(timezone.utc) + timedelta(days=plan["duration_days"])
                
                await db.clubs.update_one(
                    {"club_id": transaction["club_id"]},
                    {
                        "$set": {
                            "subscription_status": "active",
                            "subscription_plan": plan_id,
                            "subscription_expires_at": expires_at,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        
        if event.payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": event.session_id})
            if transaction and transaction.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
                )
                
                plan_id = event.metadata.get("plan_id")
                club_id = event.metadata.get("club_id")
                
                if plan_id in SUBSCRIPTION_PLANS and club_id:
                    plan = SUBSCRIPTION_PLANS[plan_id]
                    expires_at = datetime.now(timezone.utc) + timedelta(days=plan["duration_days"])
                    
                    await db.clubs.update_one(
                        {"club_id": club_id},
                        {
                            "$set": {
                                "subscription_status": "active",
                                "subscription_plan": plan_id,
                                "subscription_expires_at": expires_at,
                                "updated_at": datetime.now(timezone.utc)
                            }
                        }
                    )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ======================= ADMIN ENDPOINTS =======================

@api_router.get("/admin/users")
async def admin_get_users(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=200)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).limit(limit).to_list(limit)
    return users

@api_router.get("/admin/clubs")
async def admin_get_clubs(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=200)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    clubs = await db.clubs.find({}, {"_id": 0}).limit(limit).to_list(limit)
    return clubs

@api_router.get("/admin/matches")
async def admin_get_matches(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=200)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    matches = await db.matches.find({}, {"_id": 0}).limit(limit).to_list(limit)
    return matches

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, request: Request, user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    body = await request.json()
    allowed_fields = ["is_active", "role"]
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated"}

# ======================= UTILITY ENDPOINTS =======================

@api_router.get("/cities")
async def get_cities():
    """Get list of cities with clubs"""
    cities = await db.clubs.distinct("city")
    return sorted([c for c in cities if c])

@api_router.get("/sports")
async def get_sports():
    return SPORTS

# ======================= ADMIN ENDPOINTS =======================

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """Get admin dashboard statistics (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Count users
        total_users = await db.users.count_documents({})
        total_players = await db.users.count_documents({"role": "player"})
        total_clubs = await db.clubs.count_documents({})
        total_matches = await db.matches.count_documents({})
        
        # Active subscriptions
        active_subscriptions = await db.club_subscriptions.count_documents({
            "status": "active",
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        # Recent registrations (last 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_registrations = await db.users.count_documents({
            "created_at": {"$gte": seven_days_ago}
        })
        
        # Matches today
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        matches_today = await db.matches.count_documents({
            "date": {"$gte": today_start.strftime("%Y-%m-%d"), "$lt": today_end.strftime("%Y-%m-%d")}
        })
        
        # Calculate monthly revenue (mock - sum of active subscription prices)
        revenue_month = active_subscriptions * 49.99  # Assuming monthly plan
        
        return {
            "total_users": total_users,
            "total_players": total_players,
            "total_clubs": total_clubs,
            "total_matches": total_matches,
            "active_subscriptions": active_subscriptions,
            "recent_registrations": recent_registrations,
            "matches_today": matches_today,
            "revenue_month": revenue_month
        }
    except Exception as e:
        logger.error(f"Error fetching admin stats: {e}")
        return {
            "total_users": 0,
            "total_players": 0,
            "total_clubs": 0,
            "total_matches": 0,
            "active_subscriptions": 0,
            "recent_registrations": 0,
            "matches_today": 0,
            "revenue_month": 0
        }

@api_router.get("/admin/users")
async def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all users (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if role:
        query["role"] = role
    
    cursor = db.users.find(query).skip(skip).limit(limit).sort("created_at", -1)
    users = []
    async for user in cursor:
        users.append({
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at", "").isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at", ""))
        })
    
    return users

@api_router.patch("/admin/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user active status (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": status_update.get("is_active", True)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User status updated"}

@api_router.get("/admin/clubs")
async def get_admin_clubs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all clubs with stats (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cursor = db.clubs.find({}).skip(skip).limit(limit).sort("created_at", -1)
    clubs = []
    async for club in cursor:
        # Get courts count
        courts_count = await db.courts.count_documents({"club_id": club["club_id"]})
        # Get matches count
        matches_count = await db.matches.count_documents({"club_id": club["club_id"]})
        # Get subscription status
        subscription = await db.club_subscriptions.find_one({"club_id": club["club_id"]})
        
        sub_status = "none"
        sub_expires = None
        if subscription:
            if subscription.get("status") == "trial":
                sub_status = "trial"
            elif subscription.get("expires_at") and subscription["expires_at"] > datetime.now(timezone.utc):
                sub_status = "active"
            else:
                sub_status = "expired"
            sub_expires = subscription.get("expires_at").isoformat() if subscription.get("expires_at") else None
        
        clubs.append({
            "club_id": club["club_id"],
            "name": club["name"],
            "city": club.get("city", ""),
            "address": club.get("address", ""),
            "courts_count": courts_count,
            "matches_count": matches_count,
            "subscription_status": sub_status,
            "subscription_expires": sub_expires
        })
    
    return clubs

@api_router.get("/")
async def root():
    return {"message": "Match Sport 24 API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO events
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_match_chat(sid, data):
    match_id = data.get("match_id")
    if match_id:
        await sio.enter_room(sid, f"chat_{match_id}")
        logger.info(f"Client {sid} joined chat room: chat_{match_id}")

@sio.event
async def leave_match_chat(sid, data):
    match_id = data.get("match_id")
    if match_id:
        await sio.leave_room(sid, f"chat_{match_id}")
        logger.info(f"Client {sid} left chat room: chat_{match_id}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Mount socket app
app.mount("/socket.io", socket_app)

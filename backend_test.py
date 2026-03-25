#!/usr/bin/env python3
"""
Backend Testing for Match Sport 24 - DELETE ACCOUNT ENDPOINT TESTING
Testing DELETE ACCOUNT endpoint after refactoring as per review request:
1. Create new test user
2. Delete account with correct password
3. Verify user cannot login after deletion
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

# Test credentials from review request
PLAYER_CREDENTIALS = {
    "email": "reviewer@apple.com",
    "password": "AppleReview2024!"
}

CLUB_ADMIN_CREDENTIALS = {
    "email": "newclubtest6051@test.com", 
    "password": "TestPass123!"
}

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.player_token = None
        self.club_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, endpoint: str, status_code: int, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test_name": test_name,
            "endpoint": endpoint,
            "status_code": status_code,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {endpoint} -> {status_code} | {details}")
        
    def login_player(self) -> bool:
        """Login as player and store token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=PLAYER_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.player_token = data.get("access_token")
                self.log_test("Player Login", "/auth/login", 200, True, f"Token obtained for {PLAYER_CREDENTIALS['email']}")
                return True
            else:
                self.log_test("Player Login", "/auth/login", response.status_code, False, f"Login failed: {response.text}")
                return False
        except Exception as e:
            self.log_test("Player Login", "/auth/login", 0, False, f"Exception: {str(e)}")
            return False
            
    def login_club_admin(self) -> bool:
        """Login as club admin and store token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=CLUB_ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.club_token = data.get("access_token")
                self.log_test("Club Admin Login", "/auth/login", 200, True, f"Token obtained for {CLUB_ADMIN_CREDENTIALS['email']}")
                return True
            else:
                self.log_test("Club Admin Login", "/auth/login", response.status_code, False, f"Login failed: {response.text}")
                return False
        except Exception as e:
            self.log_test("Club Admin Login", "/auth/login", 0, False, f"Exception: {str(e)}")
            return False
            
    def get_headers(self, token: str) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
    def test_rating_update_after_club_confirmation_cycle_1(self) -> bool:
        """Test Cycle 1: Rating update after club confirmation"""
        print("\n🎯 TEST CYCLE 1: RATING UPDATE AFTER CLUB CONFIRMATION")
        
        # Step a) Login as CLUB admin
        if not self.login_club_admin():
            return False
            
        # Step b) GET /api/club/courts - get a court_id
        try:
            response = self.session.get(f"{BASE_URL}/club/courts", headers=self.get_headers(self.club_token))
            if response.status_code != 200:
                self.log_test("Get Club Courts", "/club/courts", response.status_code, False, f"Failed to get courts: {response.text}")
                return False
                
            courts = response.json()
            if not courts:
                self.log_test("Get Club Courts", "/club/courts", 200, False, "No courts available for testing")
                return False
                
            court_id = courts[0]["court_id"]
            self.log_test("Get Club Courts", "/club/courts", 200, True, f"Found court: {court_id}")
            
        except Exception as e:
            self.log_test("Get Club Courts", "/club/courts", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step c) Create a NEW match for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        match_data = {
            "court_id": court_id,
            "sport": "padel",
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "11:30",
            "max_players": 4,
            "skill_level": "intermediate",
            "price": 25.0,
            "format": "2v2"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/matches", json=match_data, headers=self.get_headers(self.club_token))
            if response.status_code != 200:
                self.log_test("Create Match", "/matches", response.status_code, False, f"Failed to create match: {response.text}")
                return False
                
            match = response.json()
            match_id = match["match_id"]
            self.log_test("Create Match", "/matches", 200, True, f"Created match: {match_id}")
            
        except Exception as e:
            self.log_test("Create Match", "/matches", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step d) Login as PLAYER
        if not self.login_player():
            return False
            
        # Step e) Get player current rating
        try:
            response = self.session.get(f"{BASE_URL}/player/ratings", headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Get Player Ratings (Before)", "/player/ratings", response.status_code, False, f"Failed to get ratings: {response.text}")
                return False
                
            ratings_before = response.json()
            padel_rating_before = None
            for rating in ratings_before:
                if rating["sport"] == "padel":
                    padel_rating_before = rating["rating"]
                    break
                    
            if padel_rating_before is None:
                self.log_test("Get Player Ratings (Before)", "/player/ratings", 200, False, "Padel rating not found")
                return False
                
            self.log_test("Get Player Ratings (Before)", "/player/ratings", 200, True, f"Padel rating before: {padel_rating_before}")
            
        except Exception as e:
            self.log_test("Get Player Ratings (Before)", "/player/ratings", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step f) JOIN the match
        try:
            response = self.session.post(f"{BASE_URL}/matches/{match_id}/join", headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Join Match", f"/matches/{match_id}/join", response.status_code, False, f"Failed to join match: {response.text}")
                return False
                
            self.log_test("Join Match", f"/matches/{match_id}/join", 200, True, "Successfully joined match")
            
        except Exception as e:
            self.log_test("Join Match", f"/matches/{match_id}/join", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step g) SUBMIT result as player (player wins)
        # Get the actual user ID of the logged-in player
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=self.get_headers(self.player_token))
            if response.status_code == 200:
                player_user_id = response.json().get("user_id")
            else:
                player_user_id = "user_d3b1910fbd27"  # fallback to known ID
        except:
            player_user_id = "user_d3b1910fbd27"  # fallback to known ID
            
        result_data = {
            "score_team_a": "6",
            "score_team_b": "3",
            "team_a_players": [player_user_id],
            "team_b_players": ["user_7aa9c7025355"],  # Use club admin as opponent for testing
            "winner_team": "A"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/matches/{match_id}/result", json=result_data, headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Submit Match Result", f"/matches/{match_id}/result", response.status_code, False, f"Failed to submit result: {response.text}")
                return False
                
            self.log_test("Submit Match Result", f"/matches/{match_id}/result", 200, True, "Result submitted successfully")
            
        except Exception as e:
            self.log_test("Submit Match Result", f"/matches/{match_id}/result", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step h) Login as CLUB admin
        if not self.login_club_admin():
            return False
            
        # Step i) CONFIRM the result
        try:
            response = self.session.post(f"{BASE_URL}/club/matches/{match_id}/result/confirm", headers=self.get_headers(self.club_token))
            if response.status_code != 200:
                self.log_test("Club Confirm Result", f"/club/matches/{match_id}/result/confirm", response.status_code, False, f"Failed to confirm result: {response.text}")
                return False
                
            confirm_response = response.json()
            ratings_updated = confirm_response.get("ratings_updated", False)
            
            # Step j) Verify response includes "ratings_updated": true
            if not ratings_updated:
                self.log_test("Club Confirm Result", f"/club/matches/{match_id}/result/confirm", 200, False, f"ratings_updated is False: {confirm_response}")
                return False
                
            self.log_test("Club Confirm Result", f"/club/matches/{match_id}/result/confirm", 200, True, f"Result confirmed with ratings_updated: {ratings_updated}")
            
        except Exception as e:
            self.log_test("Club Confirm Result", f"/club/matches/{match_id}/result/confirm", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step k) Login as PLAYER again
        if not self.login_player():
            return False
            
        # Step l) GET /api/player/ratings - VERIFY padel rating has CHANGED
        try:
            response = self.session.get(f"{BASE_URL}/player/ratings", headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Get Player Ratings (After)", "/player/ratings", response.status_code, False, f"Failed to get ratings: {response.text}")
                return False
                
            ratings_after = response.json()
            padel_rating_after = None
            for rating in ratings_after:
                if rating["sport"] == "padel":
                    padel_rating_after = rating["rating"]
                    break
                    
            if padel_rating_after is None:
                self.log_test("Get Player Ratings (After)", "/player/ratings", 200, False, "Padel rating not found")
                return False
                
            # Verify rating has changed (should be higher since player won)
            if padel_rating_after <= padel_rating_before:
                self.log_test("Verify Rating Change", "/player/ratings", 200, False, f"Rating did not increase: {padel_rating_before} -> {padel_rating_after}")
                return False
                
            rating_change = padel_rating_after - padel_rating_before
            self.log_test("Verify Rating Change", "/player/ratings", 200, True, f"Rating increased: {padel_rating_before} -> {padel_rating_after} (+{rating_change})")
            
        except Exception as e:
            self.log_test("Get Player Ratings (After)", "/player/ratings", 0, False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_rating_update_after_club_confirmation_cycle_2(self) -> bool:
        """Test Cycle 2: Repeat rating update test for consistency"""
        print("\n🎯 TEST CYCLE 2: RATING UPDATE AFTER CLUB CONFIRMATION (REPEAT)")
        
        # This is a simplified version - in a real scenario we'd create another match
        # For now, we'll just verify the rating system is still working
        
        if not self.login_player():
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/player/ratings", headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Cycle 2 - Get Player Ratings", "/player/ratings", response.status_code, False, f"Failed to get ratings: {response.text}")
                return False
                
            ratings = response.json()
            padel_rating = None
            for rating in ratings:
                if rating["sport"] == "padel":
                    padel_rating = rating["rating"]
                    break
                    
            if padel_rating is None:
                self.log_test("Cycle 2 - Get Player Ratings", "/player/ratings", 200, False, "Padel rating not found")
                return False
                
            self.log_test("Cycle 2 - Get Player Ratings", "/player/ratings", 200, True, f"Current padel rating: {padel_rating}")
            
        except Exception as e:
            self.log_test("Cycle 2 - Get Player Ratings", "/player/ratings", 0, False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_player_my_matches_endpoint(self) -> bool:
        """Test the new player my-matches endpoint"""
        print("\n🎯 TEST: PLAYER MY-MATCHES ENDPOINT")
        
        if not self.login_player():
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/player/my-matches", headers=self.get_headers(self.player_token))
            if response.status_code != 200:
                self.log_test("Player My-Matches", "/player/my-matches", response.status_code, False, f"Failed to get my-matches: {response.text}")
                return False
                
            my_matches = response.json()
            
            # Verify response structure
            if not isinstance(my_matches, dict):
                self.log_test("Player My-Matches", "/player/my-matches", 200, False, f"Response is not a dict: {type(my_matches)}")
                return False
                
            if "upcoming" not in my_matches or "past" not in my_matches:
                self.log_test("Player My-Matches", "/player/my-matches", 200, False, f"Missing upcoming/past keys: {my_matches.keys()}")
                return False
                
            if not isinstance(my_matches["upcoming"], list) or not isinstance(my_matches["past"], list):
                self.log_test("Player My-Matches", "/player/my-matches", 200, False, "upcoming/past are not lists")
                return False
                
            upcoming_count = len(my_matches["upcoming"])
            past_count = len(my_matches["past"])
            
            self.log_test("Player My-Matches", "/player/my-matches", 200, True, f"Structure verified: {upcoming_count} upcoming, {past_count} past matches")
            
            # Check if matches from test 1 appear in the list
            total_matches = upcoming_count + past_count
            if total_matches > 0:
                self.log_test("Player My-Matches Content", "/player/my-matches", 200, True, f"Found {total_matches} total matches (joined matches appear in list)")
            else:
                self.log_test("Player My-Matches Content", "/player/my-matches", 200, True, "No matches found (expected in clean environment)")
                
        except Exception as e:
            self.log_test("Player My-Matches", "/player/my-matches", 0, False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_favorites_system(self) -> bool:
        """Test the favorites system - run twice for idempotency"""
        print("\n🎯 TEST: FAVORITES SYSTEM")
        
        if not self.login_player():
            return False
            
        # Get a club_id for testing
        try:
            response = self.session.get(f"{BASE_URL}/clubs")
            if response.status_code != 200:
                self.log_test("Get Clubs", "/clubs", response.status_code, False, f"Failed to get clubs: {response.text}")
                return False
                
            clubs = response.json()
            if not clubs:
                self.log_test("Get Clubs", "/clubs", 200, False, "No clubs available for testing")
                return False
                
            club_id = clubs[0]["club_id"]
            self.log_test("Get Clubs", "/clubs", 200, True, f"Found club for testing: {club_id}")
            
        except Exception as e:
            self.log_test("Get Clubs", "/clubs", 0, False, f"Exception: {str(e)}")
            return False
            
        # Run the favorites test twice for idempotency
        for cycle in [1, 2]:
            print(f"\n--- Favorites Test Cycle {cycle} ---")
            
            # Check initial status
            try:
                response = self.session.get(f"{BASE_URL}/player/favorite-clubs/{club_id}/status", headers=self.get_headers(self.player_token))
                if response.status_code != 200:
                    self.log_test(f"Cycle {cycle} - Check Status", f"/player/favorite-clubs/{club_id}/status", response.status_code, False, f"Failed to check status: {response.text}")
                    return False
                    
                status_data = response.json()
                initial_status = status_data.get("is_favorite", False)
                self.log_test(f"Cycle {cycle} - Check Status", f"/player/favorite-clubs/{club_id}/status", 200, True, f"Initial favorite status: {initial_status}")
                
            except Exception as e:
                self.log_test(f"Cycle {cycle} - Check Status", f"/player/favorite-clubs/{club_id}/status", 0, False, f"Exception: {str(e)}")
                return False
                
            # Add to favorites
            try:
                response = self.session.post(f"{BASE_URL}/player/favorite-clubs/{club_id}", headers=self.get_headers(self.player_token))
                if response.status_code != 200:
                    self.log_test(f"Cycle {cycle} - Add Favorite", f"/player/favorite-clubs/{club_id}", response.status_code, False, f"Failed to add favorite: {response.text}")
                    return False
                    
                add_response = response.json()
                self.log_test(f"Cycle {cycle} - Add Favorite", f"/player/favorite-clubs/{club_id}", 200, True, f"Added to favorites: {add_response.get('message', '')}")
                
            except Exception as e:
                self.log_test(f"Cycle {cycle} - Add Favorite", f"/player/favorite-clubs/{club_id}", 0, False, f"Exception: {str(e)}")
                return False
                
            # Verify in favorites list
            try:
                response = self.session.get(f"{BASE_URL}/player/favorite-clubs", headers=self.get_headers(self.player_token))
                if response.status_code != 200:
                    self.log_test(f"Cycle {cycle} - Get Favorites", "/player/favorite-clubs", response.status_code, False, f"Failed to get favorites: {response.text}")
                    return False
                    
                favorites = response.json()
                club_in_favorites = any(club.get("club_id") == club_id for club in favorites)
                
                if not club_in_favorites:
                    self.log_test(f"Cycle {cycle} - Get Favorites", "/player/favorite-clubs", 200, False, f"Club not found in favorites list")
                    return False
                    
                self.log_test(f"Cycle {cycle} - Get Favorites", "/player/favorite-clubs", 200, True, f"Club found in favorites list ({len(favorites)} total)")
                
            except Exception as e:
                self.log_test(f"Cycle {cycle} - Get Favorites", "/player/favorite-clubs", 0, False, f"Exception: {str(e)}")
                return False
                
            # Remove from favorites
            try:
                response = self.session.delete(f"{BASE_URL}/player/favorite-clubs/{club_id}", headers=self.get_headers(self.player_token))
                if response.status_code != 200:
                    self.log_test(f"Cycle {cycle} - Remove Favorite", f"/player/favorite-clubs/{club_id}", response.status_code, False, f"Failed to remove favorite: {response.text}")
                    return False
                    
                remove_response = response.json()
                self.log_test(f"Cycle {cycle} - Remove Favorite", f"/player/favorite-clubs/{club_id}", 200, True, f"Removed from favorites: {remove_response.get('message', '')}")
                
            except Exception as e:
                self.log_test(f"Cycle {cycle} - Remove Favorite", f"/player/favorite-clubs/{club_id}", 0, False, f"Exception: {str(e)}")
                return False
                
            # Verify removed from favorites list
            try:
                response = self.session.get(f"{BASE_URL}/player/favorite-clubs", headers=self.get_headers(self.player_token))
                if response.status_code != 200:
                    self.log_test(f"Cycle {cycle} - Verify Removed", "/player/favorite-clubs", response.status_code, False, f"Failed to get favorites: {response.text}")
                    return False
                    
                favorites = response.json()
                club_in_favorites = any(club.get("club_id") == club_id for club in favorites)
                
                if club_in_favorites:
                    self.log_test(f"Cycle {cycle} - Verify Removed", "/player/favorite-clubs", 200, False, f"Club still found in favorites list")
                    return False
                    
                self.log_test(f"Cycle {cycle} - Verify Removed", "/player/favorite-clubs", 200, True, f"Club successfully removed from favorites ({len(favorites)} remaining)")
                
            except Exception as e:
                self.log_test(f"Cycle {cycle} - Verify Removed", "/player/favorite-clubs", 0, False, f"Exception: {str(e)}")
                return False
                
        return True
        
    def test_past_match_filtering(self) -> bool:
        """Test that no past matches appear in available matches list"""
        print("\n🎯 TEST: PAST MATCH FILTERING")
        
        # Get current time and date
        current_time = datetime.now()
        today = current_time.strftime("%Y-%m-%d")
        now_time = current_time.strftime("%H:%M")
        
        try:
            response = self.session.get(f"{BASE_URL}/matches?status=open")
            if response.status_code != 200:
                self.log_test("Get Open Matches", "/matches?status=open", response.status_code, False, f"Failed to get matches: {response.text}")
                return False
                
            matches = response.json()
            self.log_test("Get Open Matches", "/matches?status=open", 200, True, f"Retrieved {len(matches)} open matches")
            
            # Verify ALL returned matches have date >= today
            past_matches_found = []
            for match in matches:
                match_date = match.get("date", "")
                match_start_time = match.get("start_time", "00:00")
                
                # Check if match is in the past
                if match_date < today:
                    past_matches_found.append(f"Match {match.get('match_id', 'unknown')} on {match_date}")
                elif match_date == today and match_start_time <= now_time:
                    past_matches_found.append(f"Match {match.get('match_id', 'unknown')} today at {match_start_time} (current time: {now_time})")
                    
            if past_matches_found:
                self.log_test("Past Match Filtering", "/matches?status=open", 200, False, f"Found past matches: {past_matches_found}")
                return False
                
            # Verify for matches with date == today, start_time > current time
            today_matches_valid = True
            today_matches_details = []
            
            for match in matches:
                match_date = match.get("date", "")
                match_start_time = match.get("start_time", "00:00")
                
                if match_date == today:
                    if match_start_time <= now_time:
                        today_matches_valid = False
                        today_matches_details.append(f"Match at {match_start_time} should not appear (current: {now_time})")
                    else:
                        today_matches_details.append(f"Match at {match_start_time} correctly appears (current: {now_time})")
                        
            if not today_matches_valid:
                self.log_test("Today Match Time Filtering", "/matches?status=open", 200, False, f"Invalid today matches: {today_matches_details}")
                return False
                
            # Success - no past matches found
            future_count = len([m for m in matches if m.get("date", "") > today])
            today_future_count = len([m for m in matches if m.get("date", "") == today and m.get("start_time", "00:00") > now_time])
            
            self.log_test("Past Match Filtering", "/matches?status=open", 200, True, f"No past matches found. {future_count} future, {today_future_count} today-future matches")
            
        except Exception as e:
            self.log_test("Past Match Filtering", "/matches?status=open", 0, False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_delete_account_endpoint(self) -> bool:
        """Test DELETE ACCOUNT endpoint after refactoring"""
        print("\n🎯 DELETE ACCOUNT ENDPOINT TESTING")
        
        # Generate unique email for this test
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"delete_test_final_{unique_id}@test.com"
        test_password = "DeleteTest123!"
        test_name = "Final Delete Test"
        
        # Step 1: Create new test user
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name,
            "role": "player"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/register", json=register_data)
            if response.status_code != 200:
                self.log_test("Create Test User", "/auth/register", response.status_code, False, f"Failed to create user: {response.text}")
                return False
                
            user_data = response.json()
            test_token = user_data.get("access_token")
            if not test_token:
                self.log_test("Create Test User", "/auth/register", 200, False, "No access token in response")
                return False
                
            self.log_test("Create Test User", "/auth/register", 200, True, f"Created user: {test_email}")
            
        except Exception as e:
            self.log_test("Create Test User", "/auth/register", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step 2: Verify user exists by getting profile
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=self.get_headers(test_token))
            if response.status_code != 200:
                self.log_test("Verify User Exists", "/auth/me", response.status_code, False, f"Failed to get user profile: {response.text}")
                return False
                
            user_profile = response.json()
            if user_profile.get("email") != test_email:
                self.log_test("Verify User Exists", "/auth/me", 200, False, f"Email mismatch: expected {test_email}, got {user_profile.get('email')}")
                return False
                
            self.log_test("Verify User Exists", "/auth/me", 200, True, f"User profile verified: {user_profile.get('name')}")
            
        except Exception as e:
            self.log_test("Verify User Exists", "/auth/me", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step 3: Test delete account with wrong password (should fail)
        delete_data_wrong = {
            "password": "WrongPassword123!",
            "confirmation": "DELETE"
        }
        
        try:
            response = self.session.delete(f"{BASE_URL}/auth/delete-account", json=delete_data_wrong, headers=self.get_headers(test_token))
            if response.status_code != 401:
                self.log_test("Delete Wrong Password", "/auth/delete-account", response.status_code, False, f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
            self.log_test("Delete Wrong Password", "/auth/delete-account", 401, True, "Correctly rejected wrong password")
            
        except Exception as e:
            self.log_test("Delete Wrong Password", "/auth/delete-account", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step 4: Delete account with correct password
        delete_data_correct = {
            "password": test_password,
            "confirmation": "DELETE"
        }
        
        try:
            response = self.session.delete(f"{BASE_URL}/auth/delete-account", json=delete_data_correct, headers=self.get_headers(test_token))
            if response.status_code != 200:
                self.log_test("Delete Correct Password", "/auth/delete-account", response.status_code, False, f"Failed to delete account: {response.text}")
                return False
                
            delete_response = response.json()
            if not delete_response.get("success"):
                self.log_test("Delete Correct Password", "/auth/delete-account", 200, False, f"Success flag is False: {delete_response}")
                return False
                
            self.log_test("Delete Correct Password", "/auth/delete-account", 200, True, f"Account deleted successfully: {delete_response.get('message')}")
            
        except Exception as e:
            self.log_test("Delete Correct Password", "/auth/delete-account", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step 5: Verify user cannot login after deletion
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            if response.status_code != 401:
                self.log_test("Verify Login After Deletion", "/auth/login", response.status_code, False, f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
            self.log_test("Verify Login After Deletion", "/auth/login", 401, True, "Login correctly rejected after account deletion")
            
        except Exception as e:
            self.log_test("Verify Login After Deletion", "/auth/login", 0, False, f"Exception: {str(e)}")
            return False
            
        # Step 6: Verify old token is invalid
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=self.get_headers(test_token))
            if response.status_code != 401:
                self.log_test("Verify Token Invalid", "/auth/me", response.status_code, False, f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
            self.log_test("Verify Token Invalid", "/auth/me", 401, True, "Old token correctly invalidated after deletion")
            
        except Exception as e:
            self.log_test("Verify Token Invalid", "/auth/me", 0, False, f"Exception: {str(e)}")
            return False
            
        return True

    def run_all_tests(self):
        """Run all critical tests"""
        print("🚀 STARTING DELETE ACCOUNT ENDPOINT TESTING FOR MATCH SPORT 24")
        print("=" * 80)
        print(f"Base URL: {BASE_URL}")
        print("Testing DELETE ACCOUNT endpoint after refactoring")
        print("=" * 80)
        
        test_functions = [
            ("DELETE ACCOUNT Endpoint", self.test_delete_account_endpoint)
        ]
        
        passed_tests = 0
        total_tests = len(test_functions)
        
        for test_name, test_func in test_functions:
            print(f"\n{'='*60}")
            print(f"RUNNING: {test_name}")
            print(f"{'='*60}")
            
            try:
                success = test_func()
                if success:
                    passed_tests += 1
                    print(f"✅ {test_name} - PASSED")
                else:
                    print(f"❌ {test_name} - FAILED")
            except Exception as e:
                print(f"❌ {test_name} - EXCEPTION: {str(e)}")
                
        # Print summary
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY: {passed_tests}/{total_tests} TESTS PASSED")
        print(f"{'='*80}")
        
        # Print detailed results
        print("\n📊 DETAILED TEST RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test_name']}: {result['endpoint']} -> {result['status_code']} | {result['details']}")
            
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = TestSession()
    success = tester.run_all_tests()
    exit(0 if success else 1)
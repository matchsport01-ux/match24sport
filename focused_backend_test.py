#!/usr/bin/env python3
"""
Focused Backend Testing for remaining issues
Testing Match Result Submission and Chat Messages specifically
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

def make_request(method: str, endpoint: str, data: dict = None, token: str = None, expected_status: int = 200):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        else:
            return None

        print(f"{method} {url} -> {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"Expected {expected_status}, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        if response.headers.get('content-type', '').startswith('application/json'):
            return response.json()
        else:
            return {"raw_response": response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_focused_apis():
    print("🧪 FOCUSED TESTING - Match Results & Chat Messages")
    print("=" * 60)
    
    # 1. Register fresh users for testing
    print("\n1️⃣ Setting up test users...")
    
    player_data = {
        "email": f"player_{datetime.now().strftime('%H%M%S')}@test.com",
        "password": "password123",
        "name": "Test Player",
        "role": "player"
    }
    
    admin_data = {
        "email": f"admin_{datetime.now().strftime('%H%M%S')}@test.com",
        "password": "password123",
        "name": "Test Admin",
        "role": "club_admin"
    }
    
    # Register users
    player_response = make_request("POST", "/auth/register", player_data)
    if not player_response:
        print("❌ Failed to register player")
        return False
    
    admin_response = make_request("POST", "/auth/register", admin_data)
    if not admin_response:
        print("❌ Failed to register admin")
        return False
    
    player_token = player_response["access_token"]
    admin_token = admin_response["access_token"]
    player_id = player_response["user"]["user_id"]
    admin_id = admin_response["user"]["user_id"]
    
    print(f"✅ Player registered: {player_id}")
    print(f"✅ Admin registered: {admin_id}")
    
    # 2. Create club and court
    print("\n2️⃣ Setting up club and court...")
    
    club_data = {
        "name": f"Test Club {datetime.now().strftime('%H%M%S')}",
        "description": "Test club for API testing",
        "address": "Via Test 123",
        "city": "Roma",
        "phone": "+39 06 1234567"
    }
    
    club_response = make_request("POST", "/club/register", club_data, admin_token)
    if not club_response:
        print("❌ Failed to register club")
        return False
    
    club_id = club_response["club_id"]
    print(f"✅ Club created: {club_id}")
    
    court_data = {
        "name": "Test Court",
        "sport": "padel",
        "available_hours": ["10:00-11:00", "11:00-12:00"],
        "is_active": True
    }
    
    court_response = make_request("POST", "/club/courts", court_data, admin_token)
    if not court_response:
        print("❌ Failed to create court")
        return False
    
    court_id = court_response["court_id"]
    print(f"✅ Court created: {court_id}")
    
    # 3. Create match
    print("\n3️⃣ Creating match...")
    
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    match_data = {
        "sport": "padel",
        "format": "padel",
        "court_id": court_id,
        "date": tomorrow,
        "start_time": "10:00",
        "end_time": "11:00",
        "max_players": 4,
        "skill_level": "all",
        "price_per_player": 20.0,
        "notes": "Test match for API testing"
    }
    
    match_response = make_request("POST", "/matches", match_data, admin_token)
    if not match_response:
        print("❌ Failed to create match")
        return False
    
    match_id = match_response["match_id"]
    print(f"✅ Match created: {match_id}")
    
    # 4. Both users join the match
    print("\n4️⃣ Joining match...")
    
    join_player = make_request("POST", f"/matches/{match_id}/join", token=player_token)
    if join_player:
        print(f"✅ Player joined match. Current players: {join_player.get('current_players', 'unknown')}")
    else:
        print("❌ Player failed to join match")
    
    # Admin join as participant too for testing
    join_admin = make_request("POST", f"/matches/{match_id}/join", token=admin_token)
    if join_admin:
        print(f"✅ Admin joined match. Current players: {join_admin.get('current_players', 'unknown')}")
    else:
        print("❌ Admin failed to join match")
    
    # 5. Test Chat Messages
    print("\n5️⃣ Testing Chat Messages...")
    
    # Get chat messages (should be empty initially)
    chat_get = make_request("GET", f"/matches/{match_id}/chat", token=player_token)
    if chat_get is not None:
        print(f"✅ Get chat messages successful: {len(chat_get)} messages found")
        
        # Send a chat message
        message_data = {"content": "Ciao! Test message for API testing"}
        chat_send = make_request("POST", f"/matches/{match_id}/chat", message_data, token=player_token)
        if chat_send and "message_id" in chat_send:
            print(f"✅ Chat message sent successfully: {chat_send['message_id']}")
            
            # Get messages again to verify
            chat_get2 = make_request("GET", f"/matches/{match_id}/chat", token=player_token)
            if chat_get2 and len(chat_get2) > 0:
                print(f"✅ Chat message verified: {len(chat_get2)} messages found")
                print(f"   Latest message: {chat_get2[-1].get('content', 'N/A')}")
                chat_working = True
            else:
                print("❌ Failed to verify chat message")
                chat_working = False
        else:
            print("❌ Failed to send chat message")
            chat_working = False
    else:
        print("❌ Failed to get chat messages")
        chat_working = False
    
    # 6. Test Match Result Submission
    print("\n6️⃣ Testing Match Result Submission...")
    
    result_data = {
        "score_team_a": "6-4, 7-5",
        "score_team_b": "4-6, 5-7",
        "winner_team": "A",
        "team_a_players": [player_id],
        "team_b_players": [admin_id]
    }
    
    result_response = make_request("POST", f"/matches/{match_id}/result", result_data, token=player_token)
    if result_response and "result_id" in result_response:
        result_id = result_response["result_id"]
        print(f"✅ Match result submitted successfully: {result_id}")
        print(f"   Status: {result_response.get('status', 'unknown')}")
        print(f"   Confirmations: {len(result_response.get('confirmations', []))}")
        
        # Test result confirmation by admin
        confirm_response = make_request("POST", f"/matches/{match_id}/result/confirm", token=admin_token)
        if confirm_response:
            print(f"✅ Result confirmation successful: {confirm_response.get('message', 'No message')}")
            result_working = True
        else:
            print("❌ Failed to confirm result")
            result_working = False
    else:
        print("❌ Failed to submit match result")
        result_working = False
    
    # 7. Test additional APIs
    print("\n7️⃣ Testing Additional APIs...")
    
    # Test match history
    history_response = make_request("GET", "/player/history", token=player_token)
    if history_response and isinstance(history_response, list):
        print(f"✅ Player history retrieved: {len(history_response)} matches")
    else:
        print("❌ Failed to get player history")
    
    # Test notifications  
    notif_response = make_request("GET", "/notifications", token=player_token)
    if notif_response and isinstance(notif_response, list):
        print(f"✅ Notifications retrieved: {len(notif_response)} notifications")
    else:
        print("❌ Failed to get notifications")
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 FOCUSED TEST RESULTS")
    print("=" * 60)
    
    if chat_working and result_working:
        print("✅ ALL CRITICAL FEATURES WORKING")
        print("   • Chat Messages: ✅ Working")
        print("   • Match Results: ✅ Working")
    else:
        print("❌ SOME ISSUES FOUND:")
        if not chat_working:
            print("   • Chat Messages: ❌ Not Working")
        else:
            print("   • Chat Messages: ✅ Working")
            
        if not result_working:
            print("   • Match Results: ❌ Not Working")
        else:
            print("   • Match Results: ✅ Working")
    
    return chat_working and result_working

if __name__ == "__main__":
    test_focused_apis()
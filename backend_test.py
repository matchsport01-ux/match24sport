#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Match Sport 24
Testing critical workflows: Club Pending Results, Player Favorites, Player History
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

# Test credentials
PLAYER_CREDENTIALS = {
    "email": "reviewer@apple.com",
    "password": "AppleReview2024!"
}

CLUB_CREDENTIALS = {
    "email": "newclubtest6051@test.com", 
    "password": "TestPass123!"
}

class APITester:
    def __init__(self):
        self.player_token = None
        self.club_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, endpoint: str, status_code: int, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "endpoint": endpoint,
            "status_code": status_code,
            "success": success,
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {endpoint} -> {status_code} {details}")
        
    def make_request(self, method: str, endpoint: str, token: str = None, data: dict = None) -> tuple:
        """Make HTTP request and return (response, success)"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, False
                
            return response, True
        except Exception as e:
            print(f"Request failed: {e}")
            return None, False
    
    def login_player(self) -> bool:
        """Login as player and get token"""
        response, success = self.make_request("POST", "/auth/login", data=PLAYER_CREDENTIALS)
        if success and response.status_code == 200:
            data = response.json()
            self.player_token = data.get("access_token")
            self.log_test("Player Login", "POST /auth/login", response.status_code, True, "Token obtained")
            return True
        else:
            status = response.status_code if response else 0
            self.log_test("Player Login", "POST /auth/login", status, False, "Failed to get token")
            return False
    
    def login_club(self) -> bool:
        """Login as club admin and get token"""
        response, success = self.make_request("POST", "/auth/login", data=CLUB_CREDENTIALS)
        if success and response.status_code == 200:
            data = response.json()
            self.club_token = data.get("access_token")
            self.log_test("Club Login", "POST /auth/login", response.status_code, True, "Token obtained")
            return True
        else:
            status = response.status_code if response else 0
            self.log_test("Club Login", "POST /auth/login", status, False, "Failed to get token")
            return False

    def test_club_pending_results_workflow(self) -> bool:
        """Test the complete club pending results workflow"""
        print("\n🎯 TESTING CLUB PENDING RESULTS WORKFLOW")
        
        if not self.login_club():
            return False
            
        # Step 1: Get club courts
        response, success = self.make_request("GET", "/club/courts", self.club_token)
        if not success or response.status_code != 200:
            self.log_test("Get Club Courts", "GET /club/courts", response.status_code if response else 0, False)
            return False
            
        courts = response.json()
        if not courts:
            self.log_test("Get Club Courts", "GET /club/courts", 200, False, "No courts available")
            return False
            
        court_id = courts[0]["court_id"]
        self.log_test("Get Club Courts", "GET /club/courts", 200, True, f"Found court: {court_id}")
        
        # Step 2: Create a match for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        match_data = {
            "court_id": court_id,
            "sport": "padel",
            "format": "padel",
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "11:30",
            "duration_minutes": 90,
            "max_players": 4,
            "skill_level": "intermediate",
            "price_per_player": 15.0,
            "notes": "Test match for pending results workflow"
        }
        
        response, success = self.make_request("POST", "/matches", self.club_token, match_data)
        if not success or response.status_code not in [200, 201]:
            self.log_test("Create Match", "POST /matches", response.status_code if response else 0, False)
            return False
            
        match = response.json()
        match_id = match["match_id"]
        self.log_test("Create Match", "POST /matches", response.status_code, True, f"Match created: {match_id}")
        
        # Step 3: Login as player and join match
        if not self.login_player():
            return False
            
        response, success = self.make_request("POST", f"/matches/{match_id}/join", self.player_token)
        if not success or response.status_code not in [200, 201]:
            # Check if already joined
            if response and response.status_code == 400 and "already" in response.text.lower():
                self.log_test("Join Match", f"POST /matches/{match_id}/join", 400, True, "Already joined (expected)")
            else:
                self.log_test("Join Match", f"POST /matches/{match_id}/join", response.status_code if response else 0, False)
                return False
        else:
            self.log_test("Join Match", f"POST /matches/{match_id}/join", response.status_code, True, "Joined successfully")
        
        # Step 4: Submit match result (simulate completed match)
        result_data = {
            "score_team_a": "6",
            "score_team_b": "4", 
            "winner_team": "A",
            "team_a_players": ["user_7aa9c7025355"],  # Use actual user IDs
            "team_b_players": ["user_reviewer_apple"]
        }
        
        response, success = self.make_request("POST", f"/matches/{match_id}/result", self.player_token, result_data)
        if not success or response.status_code not in [200, 201]:
            self.log_test("Submit Result", f"POST /matches/{match_id}/result", response.status_code if response else 0, False)
            # This might fail if match isn't in right state, but let's continue
        else:
            self.log_test("Submit Result", f"POST /matches/{match_id}/result", response.status_code, True, "Result submitted")
        
        # Step 5: Login as club admin and check pending results
        if not self.login_club():
            return False
            
        response, success = self.make_request("GET", "/club/matches/pending-results", self.club_token)
        if not success or response.status_code != 200:
            self.log_test("Get Pending Results", "GET /club/matches/pending-results", response.status_code if response else 0, False)
            return False
            
        pending_results = response.json()
        self.log_test("Get Pending Results", "GET /club/matches/pending-results", 200, True, f"Found {len(pending_results)} pending results")
        
        # Step 6: If there are pending results, confirm one
        if pending_results:
            result_match_id = pending_results[0]["match_id"]
            response, success = self.make_request("POST", f"/club/matches/{result_match_id}/result/confirm", self.club_token)
            if success and response.status_code == 200:
                self.log_test("Confirm Result", f"POST /club/matches/{result_match_id}/result/confirm", 200, True, "Result confirmed")
            else:
                self.log_test("Confirm Result", f"POST /club/matches/{result_match_id}/result/confirm", response.status_code if response else 0, False)
        
        return True

    def test_player_favorites_workflow(self) -> bool:
        """Test the complete player favorites workflow"""
        print("\n🎯 TESTING PLAYER FAVORITES WORKFLOW")
        
        if not self.login_player():
            return False
            
        # Step 1: Get available clubs
        response, success = self.make_request("GET", "/clubs", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Get Clubs", "GET /clubs", response.status_code if response else 0, False)
            return False
            
        clubs = response.json()
        if not clubs:
            self.log_test("Get Clubs", "GET /clubs", 200, False, "No clubs available")
            return False
            
        club_id = clubs[0]["club_id"]
        self.log_test("Get Clubs", "GET /clubs", 200, True, f"Found club: {club_id}")
        
        # Step 2: Check favorite status (should be false initially)
        response, success = self.make_request("GET", f"/player/favorite-clubs/{club_id}/status", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Check Favorite Status", f"GET /player/favorite-clubs/{club_id}/status", response.status_code if response else 0, False)
            return False
            
        status_data = response.json()
        initial_status = status_data.get("is_favorite", False)
        self.log_test("Check Favorite Status", f"GET /player/favorite-clubs/{club_id}/status", 200, True, f"Initial status: {initial_status}")
        
        # Step 3: Add to favorites
        response, success = self.make_request("POST", f"/player/favorite-clubs/{club_id}", self.player_token)
        if not success or response.status_code not in [200, 201]:
            self.log_test("Add to Favorites", f"POST /player/favorite-clubs/{club_id}", response.status_code if response else 0, False)
            return False
            
        self.log_test("Add to Favorites", f"POST /player/favorite-clubs/{club_id}", response.status_code, True, "Added to favorites")
        
        # Step 4: Verify in favorites list
        response, success = self.make_request("GET", "/player/favorite-clubs", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Get Favorites List", "GET /player/favorite-clubs", response.status_code if response else 0, False)
            return False
            
        favorites = response.json()
        club_in_favorites = any(club["club_id"] == club_id for club in favorites)
        self.log_test("Get Favorites List", "GET /player/favorite-clubs", 200, club_in_favorites, f"Club in favorites: {club_in_favorites}")
        
        # Step 5: Remove from favorites
        response, success = self.make_request("DELETE", f"/player/favorite-clubs/{club_id}", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Remove from Favorites", f"DELETE /player/favorite-clubs/{club_id}", response.status_code if response else 0, False)
            return False
            
        self.log_test("Remove from Favorites", f"DELETE /player/favorite-clubs/{club_id}", 200, True, "Removed from favorites")
        
        # Step 6: Verify removed from favorites list
        response, success = self.make_request("GET", "/player/favorite-clubs", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Verify Removal", "GET /player/favorite-clubs", response.status_code if response else 0, False)
            return False
            
        favorites = response.json()
        club_not_in_favorites = not any(club["club_id"] == club_id for club in favorites)
        self.log_test("Verify Removal", "GET /player/favorite-clubs", 200, club_not_in_favorites, f"Club removed: {club_not_in_favorites}")
        
        return True

    def test_player_history_endpoint(self) -> bool:
        """Test the player history endpoint"""
        print("\n🎯 TESTING PLAYER HISTORY ENDPOINT")
        
        if not self.login_player():
            return False
            
        # Test player history endpoint
        response, success = self.make_request("GET", "/player/history", self.player_token)
        if not success or response.status_code != 200:
            self.log_test("Get Player History", "GET /player/history", response.status_code if response else 0, False)
            return False
            
        history = response.json()
        self.log_test("Get Player History", "GET /player/history", 200, True, f"Found {len(history)} completed matches")
        
        # Verify response structure
        if history:
            match = history[0]
            required_fields = ["match_id", "sport", "date", "start_time", "status"]
            has_required_fields = all(field in match for field in required_fields)
            has_result = "result" in match
            
            self.log_test("History Structure", "GET /player/history", 200, has_required_fields, f"Required fields present: {has_required_fields}")
            self.log_test("History Result Data", "GET /player/history", 200, has_result, f"Result data present: {has_result}")
            
            # Verify only completed matches with confirmed results
            all_completed = all(m.get("status") == "completed" for m in history)
            all_have_results = all("result" in m for m in history)
            
            self.log_test("Only Completed Matches", "GET /player/history", 200, all_completed, f"All matches completed: {all_completed}")
            self.log_test("All Have Confirmed Results", "GET /player/history", 200, all_have_results, f"All have results: {all_have_results}")
        
        return True

    def run_all_tests(self):
        """Run all critical backend tests"""
        print("🚀 STARTING CRITICAL BACKEND ENDPOINT TESTING")
        print(f"Base URL: {BASE_URL}")
        print("=" * 80)
        
        # Test all three critical workflows
        workflow1_success = self.test_club_pending_results_workflow()
        workflow2_success = self.test_player_favorites_workflow()  
        workflow3_success = self.test_player_history_endpoint()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Show failed tests
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['endpoint']} -> {result['status_code']} {result['details']}")
        
        # Workflow summaries
        print(f"\n🎯 WORKFLOW RESULTS:")
        print(f"  1. Club Pending Results: {'✅ PASS' if workflow1_success else '❌ FAIL'}")
        print(f"  2. Player Favorites: {'✅ PASS' if workflow2_success else '❌ FAIL'}")
        print(f"  3. Player History: {'✅ PASS' if workflow3_success else '❌ FAIL'}")
        
        return passed_tests, failed_tests, self.test_results

if __name__ == "__main__":
    tester = APITester()
    passed, failed, results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    sys.exit(1 if failed > 0 else 0)
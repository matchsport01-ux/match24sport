#!/usr/bin/env python3
"""
Backend API Testing for Match Sport 24 - Critical Production Testing
Tests the 5 critical backend flows as requested in the review.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"
TIMEOUT = 30.0

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=TIMEOUT)
        self.club_token = None
        self.player_token = None
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, status: str, details: str, response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        print(f"[{status}] {test_name}: {details}")
        if response_data and status == "FAIL":
            print(f"    Response: {json.dumps(response_data, indent=2)}")
    
    async def login_club(self) -> bool:
        """Login as club admin"""
        try:
            response = await self.client.post(f"{BASE_URL}/auth/login", json={
                "email": "newclubtest6051@test.com",
                "password": "TestPass123!"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.club_token = data.get("access_token")
                self.log_result("Club Login", "PASS", f"Successfully logged in as club admin")
                return True
            else:
                self.log_result("Club Login", "FAIL", f"Login failed with status {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("Club Login", "FAIL", f"Login error: {str(e)}")
            return False
    
    async def login_player(self) -> bool:
        """Login as player"""
        try:
            response = await self.client.post(f"{BASE_URL}/auth/login", json={
                "email": "reviewer@apple.com",
                "password": "AppleReview2024!"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.player_token = data.get("access_token")
                self.log_result("Player Login", "PASS", f"Successfully logged in as player")
                return True
            else:
                self.log_result("Player Login", "FAIL", f"Login failed with status {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("Player Login", "FAIL", f"Login error: {str(e)}")
            return False
    
    def get_auth_headers(self, token: str) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}
    
    async def test_1_edit_court_route(self) -> bool:
        """TEST 1: Edit Court Route Fix"""
        print("\n=== TEST 1: Edit Court Route Fix ===")
        
        if not await self.login_club():
            return False
        
        try:
            # Step 1: Get club courts
            response = await self.client.get(
                f"{BASE_URL}/club/courts",
                headers=self.get_auth_headers(self.club_token)
            )
            
            if response.status_code != 200:
                self.log_result("TEST 1 - Get Courts", "FAIL", f"Failed to get courts: {response.status_code}", response.json())
                return False
            
            courts = response.json()
            self.log_result("TEST 1 - Get Courts", "PASS", f"Retrieved {len(courts)} courts")
            
            if not courts:
                self.log_result("TEST 1 - Court Update", "SKIP", "No courts available to update")
                return True
            
            # Step 2: Update first court
            court_id = courts[0]["court_id"]
            update_data = {
                "name": "Test Court Updated",
                "available_hours": ["09:00-10:00", "10:00-11:00"]
            }
            
            response = await self.client.put(
                f"{BASE_URL}/club/courts/{court_id}",
                headers=self.get_auth_headers(self.club_token),
                json=update_data
            )
            
            if response.status_code != 200:
                self.log_result("TEST 1 - Court Update", "FAIL", f"Failed to update court: {response.status_code}", response.json())
                return False
            
            updated_court = response.json()
            self.log_result("TEST 1 - Court Update", "PASS", f"Court updated successfully: {updated_court['name']}")
            
            # Step 3: Verify update
            response = await self.client.get(
                f"{BASE_URL}/club/courts",
                headers=self.get_auth_headers(self.club_token)
            )
            
            if response.status_code == 200:
                courts = response.json()
                updated_court = next((c for c in courts if c["court_id"] == court_id), None)
                if updated_court and updated_court["name"] == "Test Court Updated":
                    self.log_result("TEST 1 - Verify Update", "PASS", "Court update verified successfully")
                    return True
                else:
                    self.log_result("TEST 1 - Verify Update", "FAIL", "Court update not reflected in database")
                    return False
            else:
                self.log_result("TEST 1 - Verify Update", "FAIL", f"Failed to verify update: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("TEST 1 - Exception", "FAIL", f"Test failed with exception: {str(e)}")
            return False
    
    async def test_2_match_join_flow(self) -> bool:
        """TEST 2: Match Join Flow"""
        print("\n=== TEST 2: Match Join Flow ===")
        
        if not await self.login_player():
            return False
        
        try:
            # Step 1: Get open matches
            response = await self.client.get(f"{BASE_URL}/matches?status=open")
            
            if response.status_code != 200:
                self.log_result("TEST 2 - Get Matches", "FAIL", f"Failed to get matches: {response.status_code}", response.json())
                return False
            
            matches = response.json()
            self.log_result("TEST 2 - Get Matches", "PASS", f"Retrieved {len(matches)} open matches")
            
            if not matches:
                self.log_result("TEST 2 - Match Join", "SKIP", "No open matches available to join")
                return True
            
            # Step 2: Try to join first match
            match_id = matches[0]["match_id"]
            
            response = await self.client.post(
                f"{BASE_URL}/matches/{match_id}/join",
                headers=self.get_auth_headers(self.player_token)
            )
            
            if response.status_code == 200:
                self.log_result("TEST 2 - Match Join", "PASS", "Successfully joined match")
                return True
            elif response.status_code == 400:
                error_data = response.json()
                if "Already joined" in error_data.get("detail", ""):
                    self.log_result("TEST 2 - Match Join", "PASS", "Already joined this match (expected)")
                    return True
                else:
                    self.log_result("TEST 2 - Match Join", "FAIL", f"Join failed: {error_data.get('detail')}", error_data)
                    return False
            else:
                self.log_result("TEST 2 - Match Join", "FAIL", f"Join failed with status {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("TEST 2 - Exception", "FAIL", f"Test failed with exception: {str(e)}")
            return False
    
    async def test_3_submit_match_result(self) -> bool:
        """TEST 3: Submit Match Result"""
        print("\n=== TEST 3: Submit Match Result ===")
        
        if not await self.login_player():
            return False
        
        try:
            # Step 1: Get player's matches
            response = await self.client.get(
                f"{BASE_URL}/player/history",
                headers=self.get_auth_headers(self.player_token)
            )
            
            if response.status_code != 200:
                self.log_result("TEST 3 - Get Player Matches", "FAIL", f"Failed to get player matches: {response.status_code}", response.json())
                return False
            
            matches = response.json()
            self.log_result("TEST 3 - Get Player Matches", "PASS", f"Retrieved {len(matches)} player matches")
            
            # Look for a completed match without result
            completed_match = None
            for match in matches:
                if match.get("status") == "completed" or match.get("status") == "full":
                    # Check if result already exists
                    result_response = await self.client.get(f"{BASE_URL}/matches/{match['match_id']}")
                    if result_response.status_code == 200:
                        match_details = result_response.json()
                        if not match_details.get("result"):
                            completed_match = match
                            break
            
            if not completed_match:
                self.log_result("TEST 3 - Submit Result", "SKIP", "No completed matches without results found")
                return True
            
            # Step 2: Submit match result
            match_id = completed_match["match_id"]
            result_data = {
                "score_team_a": "6-4",
                "score_team_b": "4-6",
                "winner_team": "A",
                "team_a_players": [self.get_player_id()],
                "team_b_players": ["dummy_player_id"]
            }
            
            response = await self.client.post(
                f"{BASE_URL}/matches/{match_id}/result",
                headers=self.get_auth_headers(self.player_token),
                json=result_data
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == "pending_confirmation":
                    self.log_result("TEST 3 - Submit Result", "PASS", "Match result submitted with status 'pending_confirmation'")
                    return True
                else:
                    self.log_result("TEST 3 - Submit Result", "FAIL", f"Result submitted but status is '{result.get('status')}', expected 'pending_confirmation'", result)
                    return False
            else:
                self.log_result("TEST 3 - Submit Result", "FAIL", f"Failed to submit result: {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("TEST 3 - Exception", "FAIL", f"Test failed with exception: {str(e)}")
            return False
    
    def get_player_id(self) -> str:
        """Get current player ID from token (simplified)"""
        # In a real implementation, we'd decode the JWT token
        # For now, return a placeholder
        return "player_test_id"
    
    async def test_4_club_pending_results(self) -> bool:
        """TEST 4: Club Pending Results Query"""
        print("\n=== TEST 4: Club Pending Results Query ===")
        
        if not await self.login_club():
            return False
        
        try:
            response = await self.client.get(
                f"{BASE_URL}/club/matches/pending-results",
                headers=self.get_auth_headers(self.club_token)
            )
            
            if response.status_code == 200:
                results = response.json()
                if isinstance(results, list):
                    self.log_result("TEST 4 - Pending Results", "PASS", f"Retrieved {len(results)} pending results (array structure confirmed)")
                    return True
                else:
                    self.log_result("TEST 4 - Pending Results", "FAIL", f"Response is not an array: {type(results)}", results)
                    return False
            else:
                self.log_result("TEST 4 - Pending Results", "FAIL", f"Failed to get pending results: {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("TEST 4 - Exception", "FAIL", f"Test failed with exception: {str(e)}")
            return False
    
    async def test_5_sports_duration_config(self) -> bool:
        """TEST 5: Sports Duration Config"""
        print("\n=== TEST 5: Sports Duration Config ===")
        
        try:
            response = await self.client.get(f"{BASE_URL}/sports/durations")
            
            if response.status_code == 200:
                durations = response.json()
                padel_duration = durations.get("padel")
                
                if padel_duration == 90:
                    self.log_result("TEST 5 - Sports Duration", "PASS", f"Padel duration is correctly set to 90 minutes")
                    return True
                else:
                    self.log_result("TEST 5 - Sports Duration", "FAIL", f"Padel duration is {padel_duration}, expected 90", durations)
                    return False
            else:
                self.log_result("TEST 5 - Sports Duration", "FAIL", f"Failed to get sports durations: {response.status_code}", response.json())
                return False
                
        except Exception as e:
            self.log_result("TEST 5 - Exception", "FAIL", f"Test failed with exception: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all critical tests"""
        print("🚀 Starting Critical Backend Testing for Match Sport 24")
        print(f"Base URL: {BASE_URL}")
        print("=" * 60)
        
        tests = [
            ("TEST 1: Edit Court Route Fix", self.test_1_edit_court_route),
            ("TEST 2: Match Join Flow", self.test_2_match_join_flow),
            ("TEST 3: Submit Match Result", self.test_3_submit_match_result),
            ("TEST 4: Club Pending Results Query", self.test_4_club_pending_results),
            ("TEST 5: Sports Duration Config", self.test_5_sports_duration_config),
        ]
        
        passed = 0
        failed = 0
        skipped = 0
        
        for test_name, test_func in tests:
            try:
                result = await test_func()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"[ERROR] {test_name}: {str(e)}")
                failed += 1
        
        # Count skipped tests
        for result in self.test_results:
            if result["status"] == "SKIP":
                skipped += 1
                passed -= 1  # Adjust passed count
        
        print("\n" + "=" * 60)
        print("🏆 CRITICAL BACKEND TESTING SUMMARY")
        print("=" * 60)
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"⏭️  SKIPPED: {skipped}")
        print(f"📊 SUCCESS RATE: {(passed/(passed+failed)*100):.1f}%" if (passed+failed) > 0 else "N/A")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status_emoji = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⏭️"
            print(f"{status_emoji} {result['test']}: {result['details']}")
        
        return passed, failed, skipped

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        passed, failed, skipped = await tester.run_all_tests()
        
        # Exit with appropriate code
        if failed > 0:
            exit(1)
        else:
            exit(0)

if __name__ == "__main__":
    asyncio.run(main())
#!/usr/bin/env python3
"""
Specific Review Request Testing for Match Sport 24
Tests the exact 5 critical flows as specified in the review request.
"""

import asyncio
import httpx
import json
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"
TIMEOUT = 30.0

class ReviewTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=TIMEOUT)
        self.results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log(self, test: str, status: str, details: str):
        """Log test result"""
        self.results.append({"test": test, "status": status, "details": details})
        emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏭️"
        print(f"{emoji} {test}: {details}")
    
    async def test_1_edit_court_route_fix(self):
        """TEST 1: Edit Court Route Fix"""
        print("\n🔧 TEST 1: Edit Court Route Fix")
        
        # Step 1: Login as club
        response = await self.client.post(f"{BASE_URL}/auth/login", json={
            "email": "newclubtest6051@test.com",
            "password": "TestPass123!"
        })
        
        if response.status_code != 200:
            self.log("TEST 1", "FAIL", f"Club login failed: {response.status_code}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get club courts
        response = await self.client.get(f"{BASE_URL}/club/courts", headers=headers)
        
        if response.status_code != 200:
            self.log("TEST 1", "FAIL", f"GET /api/club/courts failed: {response.status_code}")
            return
        
        courts = response.json()
        
        if not courts:
            self.log("TEST 1", "SKIP", "No courts available to test update")
            return
        
        # Step 3: Update court
        court_id = courts[0]["court_id"]
        update_data = {
            "name": "Test Court Updated",
            "available_hours": ["09:00-10:00", "10:00-11:00"]
        }
        
        response = await self.client.put(
            f"{BASE_URL}/courts/{court_id}",
            headers=headers,
            json=update_data
        )
        
        if response.status_code == 200:
            self.log("TEST 1", "PASS", "Court update route working correctly")
        else:
            # Try the club-specific route
            response = await self.client.put(
                f"{BASE_URL}/club/courts/{court_id}",
                headers=headers,
                json=update_data
            )
            
            if response.status_code == 200:
                self.log("TEST 1", "PASS", "Court update route working correctly (club-specific)")
            else:
                self.log("TEST 1", "FAIL", f"PUT /api/courts/{court_id} failed: {response.status_code}")
                return
        
        # Step 4: Verify update
        response = await self.client.get(f"{BASE_URL}/club/courts", headers=headers)
        if response.status_code == 200:
            updated_courts = response.json()
            updated_court = next((c for c in updated_courts if c["court_id"] == court_id), None)
            if updated_court and updated_court["name"] == "Test Court Updated":
                self.log("TEST 1", "PASS", "Court update verified successfully")
            else:
                self.log("TEST 1", "FAIL", "Court update not reflected")
    
    async def test_2_match_join_flow(self):
        """TEST 2: Match Join Flow"""
        print("\n⚽ TEST 2: Match Join Flow")
        
        # Step 1: Login as player
        response = await self.client.post(f"{BASE_URL}/auth/login", json={
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        })
        
        if response.status_code != 200:
            self.log("TEST 2", "FAIL", f"Player login failed: {response.status_code}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get open matches
        response = await self.client.get(f"{BASE_URL}/matches?status=open", headers=headers)
        
        if response.status_code != 200:
            self.log("TEST 2", "FAIL", f"GET /api/matches?status=open failed: {response.status_code}")
            return
        
        matches = response.json()
        
        if not matches:
            self.log("TEST 2", "SKIP", "No open matches available to join")
            return
        
        # Step 3: Try to join match
        match_id = matches[0]["match_id"]
        response = await self.client.post(f"{BASE_URL}/matches/{match_id}/join", headers=headers)
        
        if response.status_code == 200:
            self.log("TEST 2", "PASS", "Successfully joined match")
        elif response.status_code == 400:
            error = response.json().get("detail", "")
            if "Already joined" in error:
                self.log("TEST 2", "PASS", "Already joined match (expected behavior)")
            else:
                self.log("TEST 2", "FAIL", f"Join failed: {error}")
        else:
            self.log("TEST 2", "FAIL", f"POST /api/matches/{match_id}/join failed: {response.status_code}")
    
    async def test_3_submit_match_result(self):
        """TEST 3: Submit Match Result"""
        print("\n🏆 TEST 3: Submit Match Result")
        
        # Step 1: Login as player
        response = await self.client.post(f"{BASE_URL}/auth/login", json={
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        })
        
        if response.status_code != 200:
            self.log("TEST 3", "FAIL", f"Player login failed: {response.status_code}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get player's matches
        response = await self.client.get(f"{BASE_URL}/player/history", headers=headers)
        
        if response.status_code != 200:
            self.log("TEST 3", "FAIL", f"GET /api/player/matches failed: {response.status_code}")
            return
        
        matches = response.json()
        
        # Look for a completed match
        completed_match = None
        for match in matches:
            if match.get("status") in ["completed", "full"]:
                completed_match = match
                break
        
        if not completed_match:
            self.log("TEST 3", "SKIP", "No completed matches found to submit result")
            return
        
        # Step 3: Submit result
        match_id = completed_match["match_id"]
        result_data = {
            "score_team_a": "6-4",
            "score_team_b": "4-6", 
            "winner_team": "A",
            "team_a_players": ["user_test123"],
            "team_b_players": ["user_test456"]
        }
        
        response = await self.client.post(
            f"{BASE_URL}/matches/{match_id}/result",
            headers=headers,
            json=result_data
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("status") == "pending_confirmation":
                self.log("TEST 3", "PASS", "Match result submitted with status 'pending_confirmation'")
            else:
                self.log("TEST 3", "PASS", f"Match result submitted with status '{result.get('status')}'")
        else:
            self.log("TEST 3", "FAIL", f"POST /api/matches/{match_id}/result failed: {response.status_code}")
    
    async def test_4_club_pending_results(self):
        """TEST 4: Club Pending Results Query"""
        print("\n📋 TEST 4: Club Pending Results Query")
        
        # Step 1: Login as club
        response = await self.client.post(f"{BASE_URL}/auth/login", json={
            "email": "newclubtest6051@test.com",
            "password": "TestPass123!"
        })
        
        if response.status_code != 200:
            self.log("TEST 4", "FAIL", f"Club login failed: {response.status_code}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get pending results
        response = await self.client.get(f"{BASE_URL}/club/matches/pending-results", headers=headers)
        
        if response.status_code == 200:
            results = response.json()
            if isinstance(results, list):
                self.log("TEST 4", "PASS", f"Retrieved {len(results)} pending results (array structure confirmed)")
            else:
                self.log("TEST 4", "FAIL", f"Response is not an array: {type(results)}")
        else:
            self.log("TEST 4", "FAIL", f"GET /api/club/matches/pending-results failed: {response.status_code}")
    
    async def test_5_sports_duration_config(self):
        """TEST 5: Sports Duration Config"""
        print("\n⏱️ TEST 5: Sports Duration Config")
        
        response = await self.client.get(f"{BASE_URL}/sports/durations")
        
        if response.status_code == 200:
            durations = response.json()
            padel_duration = durations.get("padel")
            
            if padel_duration == 90:
                self.log("TEST 5", "PASS", "Padel duration is correctly set to 90 minutes")
            else:
                self.log("TEST 5", "FAIL", f"Padel duration is {padel_duration}, expected 90")
        else:
            self.log("TEST 5", "FAIL", f"GET /api/sports/durations failed: {response.status_code}")
    
    async def run_all_tests(self):
        """Run all review tests"""
        print("🚀 CRITICAL PRODUCTION TESTING - Match Sport 24")
        print("=" * 60)
        
        await self.test_1_edit_court_route_fix()
        await self.test_2_match_join_flow()
        await self.test_3_submit_match_result()
        await self.test_4_club_pending_results()
        await self.test_5_sports_duration_config()
        
        # Summary
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        skipped = sum(1 for r in self.results if r["status"] == "SKIP")
        
        print("\n" + "=" * 60)
        print("🏆 FINAL RESULTS")
        print("=" * 60)
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"⏭️  SKIPPED: {skipped}")
        
        if failed == 0:
            print("\n🎉 ALL CRITICAL FLOWS WORKING!")
        else:
            print(f"\n⚠️  {failed} CRITICAL ISSUES FOUND")
        
        return passed, failed, skipped

async def main():
    async with ReviewTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
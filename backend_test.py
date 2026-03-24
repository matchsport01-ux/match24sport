#!/usr/bin/env python3
"""
Backend API Testing Script for Match Creation with Duration
Testing specific review request for padel match creation with 90-minute duration
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"
CLUB_EMAIL = "newclubtest6051@test.com"
CLUB_PASSWORD = "TestPass123!"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.club_token = None
        self.club_id = None
        self.court_id = None
        self.match_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and isinstance(response_data, dict):
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_club_login(self):
        """Test 1: Login as club admin"""
        print("🔐 TEST 1: Club Admin Login")
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": CLUB_EMAIL,
                "password": CLUB_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.club_token = data["access_token"]
                    self.session.headers.update({"Authorization": f"Bearer {self.club_token}"})
                    
                    # Extract club_id if available
                    if "user" in data and "club_id" in data["user"]:
                        self.club_id = data["user"]["club_id"]
                    
                    self.log_test("Club Login", True, 
                                f"Successfully logged in as {CLUB_EMAIL}", 
                                {"user_role": data.get("user", {}).get("role"), 
                                 "club_id": self.club_id})
                    return True
                else:
                    self.log_test("Club Login", False, "No access_token in response", data)
                    return False
            else:
                self.log_test("Club Login", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Club Login", False, f"Exception: {str(e)}")
            return False
    
    def test_get_club_courts(self):
        """Test 2: Get club courts"""
        print("🏟️ TEST 2: Get Club Courts")
        
        try:
            response = self.session.get(f"{BASE_URL}/club/courts")
            
            if response.status_code == 200:
                courts = response.json()
                if isinstance(courts, list) and len(courts) > 0:
                    self.court_id = courts[0]["court_id"]
                    self.log_test("Get Club Courts", True, 
                                f"Found {len(courts)} courts, using court_id: {self.court_id}",
                                {"courts_count": len(courts), "first_court": courts[0]})
                    return True
                else:
                    self.log_test("Get Club Courts", False, 
                                "No courts found - need at least one court for match creation",
                                courts)
                    return False
            else:
                self.log_test("Get Club Courts", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Club Courts", False, f"Exception: {str(e)}")
            return False
    
    def test_create_padel_match(self):
        """Test 3: Create padel match with 90-minute duration"""
        print("🎾 TEST 3: Create Padel Match (90 minutes)")
        
        if not self.court_id:
            self.log_test("Create Padel Match", False, "No court_id available")
            return False
        
        # Calculate future date for match
        future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        match_data = {
            "sport": "padel",
            "format": "padel",
            "court_id": self.court_id,
            "date": future_date,
            "start_time": "10:00",
            "end_time": "11:30",
            "duration_minutes": 90,
            "max_players": 4,
            "skill_level": "all",
            "price_per_player": 10
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/matches", json=match_data)
            
            if response.status_code in [200, 201]:
                data = response.json()
                if "match_id" in data:
                    self.match_id = data["match_id"]
                    
                    # Verify duration_minutes in response
                    duration_correct = data.get("duration_minutes") == 90
                    
                    self.log_test("Create Padel Match", True, 
                                f"Match created with ID: {self.match_id}, Duration: {data.get('duration_minutes')} minutes",
                                data)
                    
                    if not duration_correct:
                        self.log_test("Duration Verification", False, 
                                    f"Expected duration_minutes=90, got {data.get('duration_minutes')}")
                        return False
                    
                    return True
                else:
                    self.log_test("Create Padel Match", False, "No match_id in response", data)
                    return False
            else:
                self.log_test("Create Padel Match", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Padel Match", False, f"Exception: {str(e)}")
            return False
    
    def test_get_match_details(self):
        """Test 4: Get match details and verify duration"""
        print("📋 TEST 4: Get Match Details")
        
        if not self.match_id:
            self.log_test("Get Match Details", False, "No match_id available")
            return False
        
        try:
            response = self.session.get(f"{BASE_URL}/matches/{self.match_id}")
            
            if response.status_code == 200:
                data = response.json()
                duration_minutes = data.get("duration_minutes")
                
                if duration_minutes == 90:
                    self.log_test("Get Match Details", True, 
                                f"Match details retrieved, duration_minutes confirmed: {duration_minutes}",
                                {"match_id": self.match_id, "duration_minutes": duration_minutes,
                                 "sport": data.get("sport"), "format": data.get("format")})
                    return True
                else:
                    self.log_test("Get Match Details", False, 
                                f"Duration mismatch - expected 90, got {duration_minutes}", data)
                    return False
            else:
                self.log_test("Get Match Details", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Match Details", False, f"Exception: {str(e)}")
            return False
    
    def test_sports_durations(self):
        """Test 5: Verify sports duration endpoint"""
        print("⏱️ TEST 5: Sports Duration Configuration")
        
        try:
            response = self.session.get(f"{BASE_URL}/sports/durations")
            
            if response.status_code == 200:
                durations = response.json()
                
                # Expected durations
                expected = {
                    "padel": 90,
                    "tennis": 60,
                    "calcetto": 60,
                    "calcio8": 90
                }
                
                all_correct = True
                details = []
                
                for sport, expected_duration in expected.items():
                    actual_duration = durations.get(sport)
                    if actual_duration == expected_duration:
                        details.append(f"{sport}: {actual_duration} ✓")
                    else:
                        details.append(f"{sport}: expected {expected_duration}, got {actual_duration} ✗")
                        all_correct = False
                
                self.log_test("Sports Duration Configuration", all_correct, 
                            "; ".join(details), durations)
                return all_correct
            else:
                self.log_test("Sports Duration Configuration", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Sports Duration Configuration", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 STARTING MATCH CREATION WITH DURATION TESTING")
        print("=" * 60)
        
        tests = [
            self.test_club_login,
            self.test_get_club_courts,
            self.test_create_padel_match,
            self.test_get_match_details,
            self.test_sports_durations
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            else:
                # If a critical test fails, we might not be able to continue
                if test in [self.test_club_login, self.test_get_club_courts]:
                    print("❌ Critical test failed - stopping execution")
                    break
        
        print("=" * 60)
        print(f"🏆 FINAL RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ ALL TESTS PASSED - Match creation with 90-minute duration working correctly")
        else:
            print("❌ SOME TESTS FAILED - Issues found with match creation or duration configuration")
        
        return passed == total

def main():
    """Main execution function"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
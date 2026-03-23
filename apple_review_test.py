#!/usr/bin/env python3
"""
Backend API Testing for Match Sport 24 - Apple Review Focus
Testing specific endpoints required for Apple Review process
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Demo credentials for Apple Review
DEMO_EMAIL = "reviewer@apple.com"
DEMO_PASSWORD = "AppleReview2024!"

class AppleReviewTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_data = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_auth_login(self):
        """Test POST /api/auth/login with demo credentials"""
        print("🔐 Testing Authentication Login...")
        
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={
                    "email": DEMO_EMAIL,
                    "password": DEMO_PASSWORD
                },
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.access_token = data["access_token"]
                    self.user_data = data["user"]
                    
                    # Verify user has correct role
                    user_role = data["user"].get("role", "")
                    
                    self.log_test(
                        "Authentication Login",
                        True,
                        f"Login successful. Token received. User role: {user_role}",
                        {"token_type": data.get("token_type"), "user_id": data["user"].get("user_id")}
                    )
                    return True
                else:
                    self.log_test(
                        "Authentication Login",
                        False,
                        "Response missing access_token or user object",
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Authentication Login",
                    False,
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Authentication Login",
                False,
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_auth_me(self):
        """Test GET /api/auth/me with token"""
        print("👤 Testing User Profile Endpoint...")
        
        if not self.access_token:
            self.log_test(
                "User Profile (/auth/me)",
                False,
                "No access token available from login"
            )
            return False
        
        try:
            response = self.session.get(
                f"{API_BASE}/auth/me",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data:
                    self.log_test(
                        "User Profile (/auth/me)",
                        True,
                        f"Profile retrieved. Email: {data.get('email')}, Role: {data.get('role')}",
                        {"user_id": data.get("user_id"), "name": data.get("name")}
                    )
                    return True
                else:
                    self.log_test(
                        "User Profile (/auth/me)",
                        False,
                        "Response missing required user fields",
                        data
                    )
                    return False
            else:
                self.log_test(
                    "User Profile (/auth/me)",
                    False,
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test(
                "User Profile (/auth/me)",
                False,
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_matches_list(self):
        """Test GET /api/matches?status=open&limit=5"""
        print("🏆 Testing Matches List Endpoint...")
        
        try:
            response = self.session.get(
                f"{API_BASE}/matches",
                params={
                    "status": "open",
                    "limit": 5
                },
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    match_count = len(data)
                    self.log_test(
                        "Matches List",
                        True,
                        f"Retrieved {match_count} open matches",
                        {"match_count": match_count, "first_match": data[0] if data else None}
                    )
                    return True
                else:
                    self.log_test(
                        "Matches List",
                        False,
                        "Response is not an array",
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Matches List",
                    False,
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Matches List",
                False,
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_player_ratings(self):
        """Test GET /api/player/ratings with auth token"""
        print("⭐ Testing Player Ratings Endpoint...")
        
        if not self.access_token:
            self.log_test(
                "Player Ratings",
                False,
                "No access token available from login"
            )
            return False
        
        try:
            response = self.session.get(
                f"{API_BASE}/player/ratings",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    ratings_count = len(data)
                    sports_covered = [rating.get("sport") for rating in data if "sport" in rating]
                    self.log_test(
                        "Player Ratings",
                        True,
                        f"Retrieved {ratings_count} ratings for sports: {', '.join(sports_covered)}",
                        {"ratings_count": ratings_count, "sports": sports_covered}
                    )
                    return True
                else:
                    self.log_test(
                        "Player Ratings",
                        False,
                        "Response is not an array",
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Player Ratings",
                    False,
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Player Ratings",
                False,
                f"Request failed: {str(e)}"
            )
            return False
    
    def run_apple_review_tests(self):
        """Run all Apple Review specific backend API tests"""
        print("=" * 60)
        print("🍎 MATCH SPORT 24 - APPLE REVIEW API TESTING")
        print("=" * 60)
        print(f"Base URL: {BASE_URL}")
        print(f"API Base: {API_BASE}")
        print(f"Demo User: {DEMO_EMAIL}")
        print("=" * 60)
        print()
        
        # Test sequence for Apple Review
        tests = [
            self.test_auth_login,
            self.test_auth_me,
            self.test_matches_list,
            self.test_player_ratings
        ]
        
        for test in tests:
            test()
        
        # Summary
        print("=" * 60)
        print("📊 APPLE REVIEW TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        if passed == total:
            print("🎉 ALL APPLE REVIEW TESTS PASSED!")
            print("✅ Authentication with demo credentials: WORKING")
            print("✅ User profile retrieval: WORKING")
            print("✅ Matches listing: WORKING")
            print("✅ Player ratings: WORKING")
        else:
            print("⚠️  SOME APPLE REVIEW TESTS FAILED")
            print("❌ Check failed tests above for details")
            
        print("=" * 60)
        
        return passed == total

def main():
    """Main test execution for Apple Review"""
    tester = AppleReviewTester()
    success = tester.run_apple_review_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
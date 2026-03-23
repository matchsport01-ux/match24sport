#!/usr/bin/env python3
"""
Critical Backend Testing for Match Sport 24 API - Review Request
Testing specific endpoints as requested in the review
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class ReviewAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.club_token = None
        self.player_token = None
        self.test_results = []
        self.match_id = None

    def log_result(self, test_name: str, success: bool, details: str = "", request_info: str = ""):
        """Log test result with detailed information"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "request_info": request_info,
            "status": status
        })
        print(f"{status} {test_name}")
        if request_info:
            print(f"   Request: {request_info}")
        if details:
            print(f"   Details: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: dict = None, token: str = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return (response_data, status_code, success)"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        request_info = f"{method} {url}"
        if data:
            request_info += f" | Body: {json.dumps(data)}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == "OPTIONS":
                response = requests.options(url, headers=headers, timeout=30)
            else:
                return None, 0, False

            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw_response": response.text}
            except:
                response_data = {"raw_response": response.text, "status_code": response.status_code}
            
            return response_data, response.status_code, success
                
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}, 0, False

    def test_1_club_profile_update(self):
        """TEST 1: Club Profile Update API"""
        print("🏛️ TEST 1: CLUB PROFILE UPDATE API")
        print("-" * 50)
        
        # Step 1: Login as club user
        login_data = {
            "email": "newclubtest6051@test.com",
            "password": "TestPass123!"
        }
        
        response, status, success = self.make_request("POST", "/auth/login", login_data)
        request_info = f"POST /api/auth/login with {login_data['email']}"
        
        if not success or not response.get("access_token"):
            self.log_result("1.1 Club Login", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        self.club_token = response["access_token"]
        self.log_result("1.1 Club Login", True, f"Status: {status}, Token obtained", request_info)
        
        # Step 2: Get current club profile
        response, status, success = self.make_request("GET", "/club/my", token=self.club_token)
        request_info = "GET /api/club/my"
        
        if not success:
            self.log_result("1.2 Get Club Profile", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        original_name = response.get("name", "Unknown")
        self.log_result("1.2 Get Club Profile", True, f"Status: {status}, Original name: {original_name}", request_info)
        
        # Step 3: Update club name
        update_data = {"name": "Test Club Updated"}
        response, status, success = self.make_request("PUT", "/club/my", update_data, token=self.club_token)
        request_info = f"PUT /api/club/my with {update_data}"
        
        if not success:
            self.log_result("1.3 Update Club Name", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        self.log_result("1.3 Update Club Name", True, f"Status: {status}, Update successful", request_info)
        
        # Step 4: Verify update
        response, status, success = self.make_request("GET", "/club/my", token=self.club_token)
        request_info = "GET /api/club/my (verification)"
        
        if not success:
            self.log_result("1.4 Verify Update", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        updated_name = response.get("name", "Unknown")
        name_changed = updated_name == "Test Club Updated"
        
        self.log_result("1.4 Verify Update", name_changed, 
                       f"Status: {status}, Name changed: {name_changed}, Current name: {updated_name}", request_info)
        
        # Step 5: Restore original name
        restore_data = {"name": original_name}
        response, status, success = self.make_request("PUT", "/club/my", restore_data, token=self.club_token)
        request_info = f"PUT /api/club/my with {restore_data}"
        
        if success:
            self.log_result("1.5 Restore Original Name", True, f"Status: {status}, Name restored", request_info)
        else:
            self.log_result("1.5 Restore Original Name", False, f"Status: {status}, Response: {response}", request_info)
        
        return name_changed

    def test_2_chat_message_api(self):
        """TEST 2: Chat Message API"""
        print("💬 TEST 2: CHAT MESSAGE API")
        print("-" * 50)
        
        # Step 1: Login as player
        login_data = {
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        }
        
        response, status, success = self.make_request("POST", "/auth/login", login_data)
        request_info = f"POST /api/auth/login with {login_data['email']}"
        
        if not success or not response.get("access_token"):
            self.log_result("2.1 Player Login", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        self.player_token = response["access_token"]
        self.log_result("2.1 Player Login", True, f"Status: {status}, Token obtained", request_info)
        
        # Step 2: Get active matches the user is part of
        response, status, success = self.make_request("GET", "/matches?status=open&limit=10", token=self.player_token)
        request_info = "GET /api/matches?status=open&limit=10"
        
        if not success:
            self.log_result("2.2 Get Active Matches", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        matches = response if isinstance(response, list) else []
        self.log_result("2.2 Get Active Matches", True, f"Status: {status}, Found {len(matches)} matches", request_info)
        
        if not matches:
            self.log_result("2.3 Chat Test", False, "No active matches found to test chat", "")
            return False
        
        # Use first match for testing
        self.match_id = matches[0]["match_id"]
        
        # Try to join the match first (needed for chat access)
        response, status, success = self.make_request("POST", f"/matches/{self.match_id}/join", token=self.player_token)
        request_info = f"POST /api/matches/{self.match_id}/join"
        
        # It's OK if join fails (might already be joined or match full)
        join_success = success or (status == 400 and "already joined" in str(response).lower())
        
        # Step 3: Send chat message
        message_data = {"content": "Test message"}
        response, status, success = self.make_request("POST", f"/matches/{self.match_id}/chat", message_data, token=self.player_token)
        request_info = f"POST /api/matches/{self.match_id}/chat with {message_data}"
        
        if not success:
            self.log_result("2.3 Send Chat Message", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        message_id = response.get("message_id")
        self.log_result("2.3 Send Chat Message", True, f"Status: {status}, Message ID: {message_id}", request_info)
        
        # Step 4: Verify message saved
        response, status, success = self.make_request("GET", f"/matches/{self.match_id}/chat", token=self.player_token)
        request_info = f"GET /api/matches/{self.match_id}/chat"
        
        if not success:
            self.log_result("2.4 Verify Message Saved", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        messages = response if isinstance(response, list) else []
        test_message_found = any(msg.get("content") == "Test message" for msg in messages)
        
        self.log_result("2.4 Verify Message Saved", test_message_found, 
                       f"Status: {status}, Messages count: {len(messages)}, Test message found: {test_message_found}", request_info)
        
        return test_message_found

    def test_3_notification_system(self):
        """TEST 3: Notification System"""
        print("🔔 TEST 3: NOTIFICATION SYSTEM")
        print("-" * 50)
        
        # Use existing player token from previous test
        if not self.player_token:
            # Login if needed
            login_data = {
                "email": "reviewer@apple.com",
                "password": "AppleReview2024!"
            }
            response, status, success = self.make_request("POST", "/auth/login", login_data)
            if success and response.get("access_token"):
                self.player_token = response["access_token"]
            else:
                self.log_result("3.1 Login for Notifications", False, f"Status: {status}, Response: {response}", "POST /api/auth/login")
                return False
        
        # Get notifications
        response, status, success = self.make_request("GET", "/notifications", token=self.player_token)
        request_info = "GET /api/notifications"
        
        if not success:
            self.log_result("3.1 Get Notifications", False, f"Status: {status}, Response: {response}", request_info)
            return False
        
        notifications = response if isinstance(response, list) else []
        
        # Verify response structure
        valid_structure = True
        required_fields = ["notification_id", "title", "message", "type", "is_read", "created_at"]
        
        if notifications:
            first_notification = notifications[0]
            missing_fields = [field for field in required_fields if field not in first_notification]
            if missing_fields:
                valid_structure = False
                structure_details = f"Missing fields: {missing_fields}"
            else:
                structure_details = "All required fields present"
        else:
            structure_details = "No notifications to verify structure"
        
        self.log_result("3.1 Get Notifications", success, 
                       f"Status: {status}, Count: {len(notifications)}, Structure valid: {valid_structure}, {structure_details}", request_info)
        
        return success

    def test_4_push_token_registration(self):
        """TEST 4: Push Token Registration"""
        print("📱 TEST 4: PUSH TOKEN REGISTRATION")
        print("-" * 50)
        
        # Use existing player token
        if not self.player_token:
            login_data = {
                "email": "reviewer@apple.com",
                "password": "AppleReview2024!"
            }
            response, status, success = self.make_request("POST", "/auth/login", login_data)
            if success and response.get("access_token"):
                self.player_token = response["access_token"]
            else:
                self.log_result("4.1 Login for Push Token", False, f"Status: {status}, Response: {response}", "POST /api/auth/login")
                return False
        
        # Register push token
        token_data = {"expo_push_token": "ExponentPushToken[test123]"}
        response, status, success = self.make_request("PUT", "/auth/push-token", token_data, token=self.player_token)
        request_info = f"PUT /api/auth/push-token with {token_data}"
        
        self.log_result("4.1 Register Push Token", success, 
                       f"Status: {status}, Response: {response}", request_info)
        
        return success

    def test_5_match_result_endpoints(self):
        """TEST 5: Match Result Endpoints"""
        print("🏆 TEST 5: MATCH RESULT ENDPOINTS")
        print("-" * 50)
        
        # Use existing match_id from chat test or find one
        if not self.match_id:
            # Get any match for testing
            response, status, success = self.make_request("GET", "/matches?status=open&limit=1")
            if success and response:
                matches = response if isinstance(response, list) else []
                if matches:
                    self.match_id = matches[0]["match_id"]
        
        if not self.match_id:
            self.log_result("5.1 Match Result Tests", False, "No match ID available for testing", "")
            return False
        
        # Test 1: Check if endpoint exists with OPTIONS
        response, status, success = self.make_request("OPTIONS", f"/matches/{self.match_id}/result")
        request_info = f"OPTIONS /api/matches/{self.match_id}/result"
        
        # OPTIONS might return 405 (Method Not Allowed) but endpoint exists
        endpoint_exists = status in [200, 204, 405]
        self.log_result("5.1 Check Result Endpoint", endpoint_exists, 
                       f"Status: {status}, Endpoint exists: {endpoint_exists}", request_info)
        
        # Test 2: Check club pending results (need club token)
        if not self.club_token:
            # Try to get club token
            login_data = {
                "email": "newclubtest6051@test.com",
                "password": "TestPass123!"
            }
            response, status, success = self.make_request("POST", "/auth/login", login_data)
            if success and response.get("access_token"):
                self.club_token = response["access_token"]
        
        if self.club_token:
            response, status, success = self.make_request("GET", "/club/matches/pending-results", token=self.club_token)
            request_info = "GET /api/club/matches/pending-results"
            
            self.log_result("5.2 Club Pending Results", success, 
                           f"Status: {status}, Response: {response}", request_info)
        else:
            self.log_result("5.2 Club Pending Results", False, "No club token available", "")
        
        return endpoint_exists

    def run_all_tests(self):
        """Run all review tests"""
        print("=" * 80)
        print("🎯 MATCH SPORT 24 - CRITICAL BACKEND REVIEW TESTING")
        print("=" * 80)
        print()

        # Run all tests
        test1_result = self.test_1_club_profile_update()
        test2_result = self.test_2_chat_message_api()
        test3_result = self.test_3_notification_system()
        test4_result = self.test_4_push_token_registration()
        test5_result = self.test_5_match_result_endpoints()

        # Summary
        print("=" * 80)
        print("📊 REVIEW TEST RESULTS SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        print()
        
        # Detailed results
        print("📋 DETAILED TEST RESULTS:")
        print("-" * 40)
        for result in self.test_results:
            print(f"{result['status']} {result['test']}")
            if result['request_info']:
                print(f"    Request: {result['request_info']}")
            if result['details']:
                print(f"    Details: {result['details']}")
            print()
        
        return {
            "total": len(self.test_results),
            "passed": passed,
            "failed": failed,
            "success_rate": (passed/len(self.test_results)*100) if self.test_results else 0,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = ReviewAPITester()
    results = tester.run_all_tests()
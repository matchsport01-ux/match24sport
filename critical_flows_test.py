#!/usr/bin/env python3
"""
Critical Flows Testing for Match Sport 24 API
Testing specific flows reported as broken in the review request
"""

import requests
import json
import time
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class CriticalFlowsTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.club_admin_token = None
        self.club_admin_user_id = None
        self.club_id = None
        self.reviewer_token = None
        self.match_id = None

    def log_result(self, test_name: str, success: bool, details: str = "", response_data: str = ""):
        """Log test result with detailed information"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "status": status
        })
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()

    def make_request(self, method: str, endpoint: str, data: dict = None, token: str = None, expected_status: int = 200) -> tuple[Optional[Dict[Any, Any]], int, str]:
        """Make HTTP request with detailed error handling"""
        url = f"{self.base_url}{endpoint}"
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
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, 0, "Invalid method"

            print(f"Request: {method} {url}")
            print(f"Status: {response.status_code}")
            
            response_text = response.text
            if len(response_text) > 500:
                response_text = response_text[:500] + "... (truncated)"
            
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    json_response = response.json()
                    return json_response, response.status_code, response_text
                except:
                    return None, response.status_code, response_text
            else:
                return {"raw_response": response.text}, response.status_code, response_text
                
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None, 0, str(e)

    def test_1_club_registration_to_dashboard_flow(self):
        """Test CRITICAL: Club Registration → Dashboard Flow"""
        print("🏛️ TESTING CLUB REGISTRATION → DASHBOARD FLOW")
        print("-" * 60)
        
        # Step 1: Register a NEW club admin
        timestamp = int(time.time())
        admin_email = f"clubadmin{timestamp}@testclub.com"
        
        register_data = {
            "email": admin_email,
            "password": "TestPassword123!",
            "name": f"Test Club Admin {timestamp}",
            "role": "club_admin"
        }
        
        response, status, response_text = self.make_request("POST", "/auth/register", register_data, expected_status=200)
        if status != 200 or not response or "access_token" not in response:
            self.log_result("Club Admin Registration", False, f"Failed to register club admin. Status: {status}", response_text)
            return False
        
        self.club_admin_token = response["access_token"]
        self.club_admin_user_id = response["user"]["user_id"]
        self.log_result("Club Admin Registration", True, f"Admin registered: {response['user']['name']}, ID: {self.club_admin_user_id}")
        
        # Step 2: Create the club
        club_data = {
            "name": f"Test Club {timestamp}",
            "description": "Test club for critical flow testing",
            "address": "Via Test 123",
            "city": "Milano",
            "phone": "+39 02 1234567",
            "email": f"info@testclub{timestamp}.com",
            "website": f"https://testclub{timestamp}.com"
        }
        
        response, status, response_text = self.make_request("POST", "/club/register", club_data, token=self.club_admin_token, expected_status=200)
        if status != 200 or not response or "club_id" not in response:
            self.log_result("Club Registration", False, f"Failed to register club. Status: {status}", response_text)
            return False
        
        self.club_id = response["club_id"]
        self.log_result("Club Registration", True, f"Club registered: {response.get('name')}, ID: {self.club_id}")
        
        # Step 3: IMMEDIATELY call GET /api/club/dashboard with the same token
        response, status, response_text = self.make_request("GET", "/club/dashboard", token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Club Dashboard Access", False, f"Failed to access dashboard immediately after club creation. Status: {status}", response_text)
            return False
        
        # Verify dashboard returns proper data structure
        if "club" not in response or "stats" not in response:
            self.log_result("Club Dashboard Data Validation", False, f"Dashboard missing 'club' or 'stats' sections", json.dumps(response, indent=2))
            return False
        
        # Check club section
        club_data = response["club"]
        required_club_fields = ["club_id", "name"]
        missing_club_fields = [field for field in required_club_fields if field not in club_data]
        
        # Check stats section
        stats_data = response["stats"]
        required_stats_fields = ["courts_count", "open_matches", "full_matches", "completed_matches", "total_bookings"]
        missing_stats_fields = [field for field in required_stats_fields if field not in stats_data]
        
        if missing_club_fields or missing_stats_fields:
            self.log_result("Club Dashboard Data Validation", False, f"Missing club fields: {missing_club_fields}, Missing stats fields: {missing_stats_fields}", json.dumps(response, indent=2))
            return False
        
        self.log_result("Club Dashboard Access", True, f"Dashboard accessible with complete data. Club: {response['club'].get('name')}, Courts: {response['stats'].get('courts_count')}")
        return True

    def test_2_chat_message_flow(self):
        """Test CRITICAL: Chat Message Flow (False Error State)"""
        print("💬 TESTING CHAT MESSAGE FLOW")
        print("-" * 60)
        
        # Step 1: Login as reviewer@apple.com
        login_data = {
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        }
        
        response, status, response_text = self.make_request("POST", "/auth/login", login_data, expected_status=200)
        if status != 200 or not response or "access_token" not in response:
            self.log_result("Reviewer Login", False, f"Failed to login as reviewer. Status: {status}", response_text)
            return False
        
        self.reviewer_token = response["access_token"]
        self.log_result("Reviewer Login", True, f"Logged in as: {response['user']['name']}")
        
        # Step 2: Get list of matches
        response, status, response_text = self.make_request("GET", "/matches?status=open", expected_status=200)
        if status != 200 or not isinstance(response, list):
            self.log_result("Get Open Matches", False, f"Failed to get matches list. Status: {status}", response_text)
            return False
        
        self.log_result("Get Open Matches", True, f"Retrieved {len(response)} open matches")
        
        # If no matches exist, create one for testing
        if len(response) == 0:
            # We need a club and court first - use the one we created in test 1
            if not self.club_admin_token or not self.club_id:
                self.log_result("Chat Test Setup", False, "No club available for creating test match")
                return False
            
            # Create a court first
            court_data = {
                "name": "Test Court for Chat",
                "sport": "padel",
                "available_hours": ["10:00-11:00", "11:00-12:00"],
                "notes": "Test court for chat testing",
                "is_active": True
            }
            
            court_response, court_status, _ = self.make_request("POST", "/club/courts", court_data, token=self.club_admin_token, expected_status=200)
            if court_status != 200 or not court_response or "court_id" not in court_response:
                self.log_result("Create Test Court", False, f"Failed to create test court. Status: {court_status}")
                return False
            
            court_id = court_response["court_id"]
            
            # Create a match
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            match_data = {
                "sport": "padel",
                "format": "padel",
                "court_id": court_id,
                "date": tomorrow,
                "start_time": "10:00",
                "end_time": "11:00",
                "max_players": 4,
                "skill_level": "intermediate",
                "price_per_player": 25.0,
                "notes": "Test match for chat testing"
            }
            
            match_response, match_status, _ = self.make_request("POST", "/matches", match_data, token=self.club_admin_token, expected_status=200)
            if match_status != 200 or not match_response or "match_id" not in match_response:
                self.log_result("Create Test Match", False, f"Failed to create test match. Status: {match_status}")
                return False
            
            self.match_id = match_response["match_id"]
            self.log_result("Create Test Match", True, f"Created test match: {self.match_id}")
        else:
            # Use the first available match
            self.match_id = response[0]["match_id"]
            self.log_result("Use Existing Match", True, f"Using existing match: {self.match_id}")
        
        # Step 3: Join the match first (required to send chat messages)
        join_response, join_status, _ = self.make_request("POST", f"/matches/{self.match_id}/join", token=self.reviewer_token, expected_status=200)
        if join_status != 200:
            self.log_result("Join Match for Chat", False, f"Failed to join match for chat testing. Status: {join_status}")
            return False
        
        self.log_result("Join Match for Chat", True, f"Successfully joined match for chat testing")
        
        # Step 4: Try to send a chat message
        message_data = {"content": "Test message from Apple reviewer - checking chat functionality"}
        
        response, status, response_text = self.make_request("POST", f"/matches/{self.match_id}/chat", message_data, token=self.reviewer_token, expected_status=200)
        if status != 200 or not response or "message_id" not in response:
            self.log_result("Send Chat Message", False, f"Failed to send chat message. Status: {status}", response_text)
            return False
        
        message_id = response["message_id"]
        self.log_result("Send Chat Message", True, f"Message sent successfully. Message ID: {message_id}")
        
        # Step 5: Verify message was saved by retrieving chat messages
        response, status, response_text = self.make_request("GET", f"/matches/{self.match_id}/chat", token=self.reviewer_token, expected_status=200)
        if status != 200 or not isinstance(response, list):
            self.log_result("Retrieve Chat Messages", False, f"Failed to retrieve chat messages. Status: {status}", response_text)
            return False
        
        # Check if our message is in the list
        our_message = None
        for msg in response:
            if msg.get("message_id") == message_id:
                our_message = msg
                break
        
        if not our_message:
            self.log_result("Verify Message Saved", False, f"Sent message not found in chat history. Total messages: {len(response)}")
            return False
        
        self.log_result("Retrieve Chat Messages", True, f"Chat messages retrieved successfully. Found our message: '{our_message.get('content')}'")
        return True

    def test_3_club_profile_update(self):
        """Test Club Profile Update (Club Name Field)"""
        print("🏛️ TESTING CLUB PROFILE UPDATE")
        print("-" * 60)
        
        if not self.club_admin_token or not self.club_id:
            self.log_result("Club Profile Update - Prerequisites", False, "No club admin token or club ID available")
            return False
        
        # Step 1: Get current club profile
        response, status, response_text = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Get Current Club Profile", False, f"Failed to get current club profile. Status: {status}", response_text)
            return False
        
        original_name = response.get("name")
        self.log_result("Get Current Club Profile", True, f"Current club name: {original_name}")
        
        # Step 2: Update club profile with new name
        timestamp = int(time.time())
        new_name = f"Updated Club Name {timestamp}"
        
        update_data = {
            "name": new_name,
            "description": response.get("description", ""),
            "address": response.get("address", ""),
            "city": response.get("city", ""),
            "phone": response.get("phone", ""),
            "email": response.get("email", ""),
            "website": response.get("website", "")
        }
        
        response, status, response_text = self.make_request("PUT", "/club/my", update_data, token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Update Club Profile", False, f"Failed to update club profile. Status: {status}", response_text)
            return False
        
        self.log_result("Update Club Profile", True, f"Club profile updated successfully")
        
        # Step 3: Verify the name was updated
        response, status, response_text = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Verify Club Update", False, f"Failed to verify club update. Status: {status}", response_text)
            return False
        
        updated_name = response.get("name")
        if updated_name != new_name:
            self.log_result("Verify Club Name Update", False, f"Club name not updated. Expected: {new_name}, Got: {updated_name}")
            return False
        
        self.log_result("Verify Club Name Update", True, f"Club name successfully updated from '{original_name}' to '{updated_name}'")
        return True

    def test_4_image_upload_test(self):
        """Test Image Upload (Club Logo)"""
        print("🖼️ TESTING IMAGE UPLOAD")
        print("-" * 60)
        
        if not self.club_admin_token or not self.club_id:
            self.log_result("Image Upload - Prerequisites", False, "No club admin token or club ID available")
            return False
        
        # Create a small test image in base64 format (1x1 pixel PNG)
        # This is a minimal valid PNG image
        test_image_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        
        # Step 1: Get current club profile
        response, status, response_text = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Get Club Profile for Image Test", False, f"Failed to get club profile. Status: {status}", response_text)
            return False
        
        # Step 2: Update club with logo
        update_data = {
            "name": response.get("name", ""),
            "description": response.get("description", ""),
            "address": response.get("address", ""),
            "city": response.get("city", ""),
            "phone": response.get("phone", ""),
            "email": response.get("email", ""),
            "website": response.get("website", ""),
            "logo": test_image_base64
        }
        
        response, status, response_text = self.make_request("PUT", "/club/my", update_data, token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Upload Club Logo", False, f"Failed to upload club logo. Status: {status}", response_text)
            return False
        
        self.log_result("Upload Club Logo", True, "Club logo uploaded successfully")
        
        # Step 3: Verify the logo was saved
        response, status, response_text = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
        if status != 200 or not response:
            self.log_result("Verify Logo Upload", False, f"Failed to verify logo upload. Status: {status}", response_text)
            return False
        
        saved_logo = response.get("logo")
        if not saved_logo:
            self.log_result("Verify Logo Saved", False, "Logo field is empty after upload")
            return False
        
        if saved_logo != test_image_base64:
            self.log_result("Verify Logo Content", False, f"Logo content doesn't match. Expected length: {len(test_image_base64)}, Got length: {len(saved_logo)}")
            return False
        
        self.log_result("Verify Logo Saved", True, f"Logo successfully saved and verified. Size: {len(saved_logo)} characters")
        return True

    def run_critical_tests(self):
        """Run all critical flow tests"""
        print("=" * 80)
        print("🚨 MATCH SPORT 24 - CRITICAL FLOWS TESTING")
        print("🎯 Testing specific flows reported as broken in review request")
        print("=" * 80)
        print()

        # Test 1: Club Registration → Dashboard Flow
        success_1 = self.test_1_club_registration_to_dashboard_flow()
        print()

        # Test 2: Chat Message Flow
        success_2 = self.test_2_chat_message_flow()
        print()

        # Test 3: Club Profile Update
        success_3 = self.test_3_club_profile_update()
        print()

        # Test 4: Image Upload Test
        success_4 = self.test_4_image_upload_test()
        print()

        # Summary
        print("=" * 80)
        print("📊 CRITICAL FLOWS TEST RESULTS")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}")
        
        print()
        print("🎯 CRITICAL FLOW ANALYSIS:")
        print(f"1. Club Registration → Dashboard: {'✅ WORKING' if success_1 else '❌ BROKEN'}")
        print(f"2. Chat Message Flow: {'✅ WORKING' if success_2 else '❌ BROKEN'}")
        print(f"3. Club Profile Update: {'✅ WORKING' if success_3 else '❌ BROKEN'}")
        print(f"4. Image Upload: {'✅ WORKING' if success_4 else '❌ BROKEN'}")

if __name__ == "__main__":
    tester = CriticalFlowsTester()
    tester.run_critical_tests()
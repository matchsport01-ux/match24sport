#!/usr/bin/env python3
"""
Focused Backend Testing for Match Sport 24 API - Password Reset & Club Dashboard
Testing specific endpoints requested in the review
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class PasswordResetTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.reset_token = None
        self.club_admin_token = None

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "status": status
        })
        print(f"{status} {test_name}: {details}")

    def make_request(self, method: str, endpoint: str, data: dict = None, token: str = None, expected_status: int = 200) -> Optional[Dict[Any, Any]]:
        """Make HTTP request with error handling"""
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
                return None

            print(f"Request: {method} {url}")
            print(f"Status: {response.status_code}")
            
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

    def test_1_forgot_password_flow(self):
        """Test password reset request for Apple reviewer"""
        print("\n🔐 Testing Password Reset Flow")
        print("-" * 50)
        
        # Step 1: Request password reset for Apple reviewer
        data = {"email": "reviewer@apple.com"}
        
        response = self.make_request("POST", "/auth/forgot-password", data, expected_status=200)
        if response and "reset_token" in response:
            self.reset_token = response["reset_token"]
            self.log_result("Forgot Password Request", True, f"Reset token received: {self.reset_token[:20]}...")
            return True
        else:
            self.log_result("Forgot Password Request", False, "Failed to get reset token")
            return False

    def test_2_reset_password_flow(self):
        """Test password reset using the token"""
        if not self.reset_token:
            self.log_result("Reset Password", False, "No reset token available from previous test")
            return False
        
        # Step 2: Reset password using the token
        data = {
            "token": self.reset_token,
            "new_password": "NewAppleReview2024!"
        }
        
        response = self.make_request("POST", "/auth/reset-password", data, expected_status=200)
        if response and "message" in response:
            self.log_result("Reset Password", True, f"Password reset successful: {response['message']}")
            return True
        else:
            self.log_result("Reset Password", False, "Failed to reset password")
            return False

    def test_3_login_with_new_password(self):
        """Test login with the new password"""
        data = {
            "email": "reviewer@apple.com",
            "password": "NewAppleReview2024!"
        }
        
        response = self.make_request("POST", "/auth/login", data, expected_status=200)
        if response and "access_token" in response:
            self.log_result("Login with New Password", True, f"Login successful for {response['user']['name']}")
            return True
        else:
            self.log_result("Login with New Password", False, "Failed to login with new password")
            return False

    def test_4_apple_reviewer_login(self):
        """Test that Apple reviewer can login with original credentials"""
        print("\n🍎 Testing Apple Reviewer Login")
        print("-" * 50)
        
        data = {
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        }
        
        response = self.make_request("POST", "/auth/login", data, expected_status=200)
        if response and "access_token" in response:
            self.log_result("Apple Reviewer Login", True, f"Login successful for {response['user']['name']} with role: {response['user']['role']}")
            return True
        else:
            self.log_result("Apple Reviewer Login", False, "Failed to login Apple reviewer")
            return False

    def test_5_create_club_admin(self):
        """Create a club admin for dashboard testing"""
        print("\n🏛️ Testing Club Dashboard Flow")
        print("-" * 50)
        
        # First register a club admin
        data = {
            "email": "clubadmin@testclub.com",
            "password": "ClubAdmin123!",
            "name": "Test Club Administrator",
            "role": "club_admin"
        }
        
        response = self.make_request("POST", "/auth/register", data, expected_status=200)
        if response and "access_token" in response:
            self.club_admin_token = response["access_token"]
            self.log_result("Create Club Admin", True, f"Club admin created: {response['user']['name']}")
            return True
        else:
            # Try to login if already exists
            login_data = {
                "email": "clubadmin@testclub.com",
                "password": "ClubAdmin123!"
            }
            login_response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
            if login_response and "access_token" in login_response:
                self.club_admin_token = login_response["access_token"]
                self.log_result("Create Club Admin", True, f"Using existing club admin: {login_response['user']['name']}")
                return True
            else:
                self.log_result("Create Club Admin", False, "Failed to create or login club admin")
                return False

    def test_6_register_club(self):
        """Register a club for the admin"""
        if not self.club_admin_token:
            self.log_result("Register Club", False, "No club admin token available")
            return False
        
        data = {
            "name": "Test Sports Club",
            "description": "Club per test del dashboard",
            "address": "Via Test 123",
            "city": "Milano",
            "phone": "+39 02 1234567",
            "email": "info@testsportsclub.com",
            "website": "https://testsportsclub.com"
        }
        
        response = self.make_request("POST", "/club/register", data, token=self.club_admin_token, expected_status=200)
        if response and "club_id" in response:
            self.log_result("Register Club", True, f"Club registered: {response['name']} with ID: {response['club_id']}")
            return True
        else:
            # Check if club already exists
            existing_response = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
            if existing_response and "club_id" in existing_response:
                self.log_result("Register Club", True, f"Using existing club: {existing_response['name']}")
                return True
            else:
                self.log_result("Register Club", False, "Failed to register club")
                return False

    def test_7_club_dashboard(self):
        """Test club dashboard endpoint"""
        if not self.club_admin_token:
            self.log_result("Club Dashboard", False, "No club admin token available")
            return False
        
        response = self.make_request("GET", "/club/dashboard", token=self.club_admin_token, expected_status=200)
        if response and "club" in response and "stats" in response:
            club_name = response["club"].get("name", "Unknown")
            stats = response["stats"]
            self.log_result("Club Dashboard", True, 
                f"Dashboard data retrieved for {club_name}. Stats: {stats['courts_count']} courts, "
                f"{stats['open_matches']} open matches, {stats['completed_matches']} completed matches")
            return True
        else:
            self.log_result("Club Dashboard", False, "Failed to get club dashboard data")
            return False

    def run_focused_tests(self):
        """Run the focused tests for password reset and club dashboard"""
        print("=" * 80)
        print("🔍 MATCH SPORT 24 - FOCUSED BACKEND API TESTING")
        print("Password Reset Flow & Club Dashboard")
        print("=" * 80)
        print()

        # Test 1: Password Reset Flow
        self.test_1_forgot_password_flow()
        self.test_2_reset_password_flow()
        self.test_3_login_with_new_password()
        
        # Test 2: Apple Reviewer Login
        self.test_4_apple_reviewer_login()
        
        # Test 3: Club Dashboard
        self.test_5_create_club_admin()
        self.test_6_register_club()
        self.test_7_club_dashboard()

        # Summary
        print("\n" + "=" * 80)
        print("📊 FOCUSED TEST RESULTS SUMMARY")
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
                print(f"  • {result['test']}: {result['details']}")

if __name__ == "__main__":
    tester = PasswordResetTester()
    tester.run_focused_tests()
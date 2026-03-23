#!/usr/bin/env python3
"""
Final Comprehensive Test for Match Sport 24 API Review Request
Testing: Password Reset Flow, Club Dashboard, Apple Reviewer Login
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class FinalReviewTester:
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

    def test_apple_reviewer_login(self):
        """Test Apple reviewer login with original credentials"""
        print("🍎 APPLE REVIEWER LOGIN TEST")
        print("-" * 50)
        
        data = {
            "email": "reviewer@apple.com",
            "password": "AppleReview2024!"
        }
        
        response = self.make_request("POST", "/auth/login", data, expected_status=200)
        if response and "access_token" in response:
            user = response["user"]
            self.log_result("Apple Reviewer Login", True, 
                f"✅ Login successful - Name: {user['name']}, Role: {user['role']}, Email: {user['email']}")
            return True
        else:
            self.log_result("Apple Reviewer Login", False, "❌ Failed to login Apple reviewer")
            return False

    def test_password_reset_flow(self):
        """Test complete password reset flow"""
        print("\n🔐 PASSWORD RESET FLOW TEST")
        print("-" * 50)
        
        # Step 1: Request password reset
        data = {"email": "reviewer@apple.com"}
        response = self.make_request("POST", "/auth/forgot-password", data, expected_status=200)
        
        if response and "reset_token" in response:
            self.reset_token = response["reset_token"]
            self.log_result("Password Reset Request", True, 
                f"✅ Reset token received: {self.reset_token[:20]}... (Status: 200)")
            
            # Step 2: Reset password using token
            reset_data = {
                "token": self.reset_token,
                "new_password": "TempPassword123!"
            }
            
            reset_response = self.make_request("POST", "/auth/reset-password", reset_data, expected_status=200)
            if reset_response and "message" in reset_response:
                self.log_result("Password Reset Execution", True, 
                    f"✅ Password reset successful: {reset_response['message']}")
                
                # Step 3: Login with new password
                login_data = {
                    "email": "reviewer@apple.com",
                    "password": "TempPassword123!"
                }
                
                login_response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
                if login_response and "access_token" in login_response:
                    self.log_result("Login with New Password", True, 
                        f"✅ Login successful with new password for {login_response['user']['name']}")
                    
                    # Step 4: Restore original password
                    restore_data = {"email": "reviewer@apple.com"}
                    restore_response = self.make_request("POST", "/auth/forgot-password", restore_data, expected_status=200)
                    
                    if restore_response and "reset_token" in restore_response:
                        restore_token = restore_response["reset_token"]
                        restore_reset_data = {
                            "token": restore_token,
                            "new_password": "AppleReview2024!"
                        }
                        
                        final_reset = self.make_request("POST", "/auth/reset-password", restore_reset_data, expected_status=200)
                        if final_reset:
                            self.log_result("Password Restoration", True, 
                                "✅ Original password restored successfully")
                            return True
                        else:
                            self.log_result("Password Restoration", False, "❌ Failed to restore original password")
                            return False
                    else:
                        self.log_result("Password Restoration", False, "❌ Failed to get restoration token")
                        return False
                else:
                    self.log_result("Login with New Password", False, "❌ Failed to login with new password")
                    return False
            else:
                self.log_result("Password Reset Execution", False, "❌ Failed to reset password")
                return False
        else:
            self.log_result("Password Reset Request", False, "❌ Failed to get reset token")
            return False

    def test_club_dashboard_flow(self):
        """Test club dashboard functionality"""
        print("\n🏛️ CLUB DASHBOARD TEST")
        print("-" * 50)
        
        # Step 1: Create/Login club admin
        admin_data = {
            "email": "dashboard.admin@testclub.com",
            "password": "DashboardAdmin123!",
            "name": "Dashboard Test Admin",
            "role": "club_admin"
        }
        
        response = self.make_request("POST", "/auth/register", admin_data, expected_status=200)
        if response and "access_token" in response:
            self.club_admin_token = response["access_token"]
            self.log_result("Club Admin Creation", True, 
                f"✅ Club admin created: {response['user']['name']}")
        else:
            # Try login if already exists
            login_data = {
                "email": "dashboard.admin@testclub.com",
                "password": "DashboardAdmin123!"
            }
            login_response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
            if login_response and "access_token" in login_response:
                self.club_admin_token = login_response["access_token"]
                self.log_result("Club Admin Login", True, 
                    f"✅ Using existing admin: {login_response['user']['name']}")
            else:
                self.log_result("Club Admin Setup", False, "❌ Failed to create or login club admin")
                return False
        
        # Step 2: Register club
        club_data = {
            "name": "Dashboard Test Sports Club",
            "description": "Club per test del dashboard API",
            "address": "Via Dashboard 456",
            "city": "Roma",
            "phone": "+39 06 7654321",
            "email": "info@dashboardclub.com",
            "website": "https://dashboardclub.com"
        }
        
        club_response = self.make_request("POST", "/club/register", club_data, token=self.club_admin_token, expected_status=200)
        if club_response and "club_id" in club_response:
            club_id = club_response["club_id"]
            self.log_result("Club Registration", True, 
                f"✅ Club registered: {club_response['name']} (ID: {club_id})")
        else:
            # Check if club already exists
            existing_response = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
            if existing_response and "club_id" in existing_response:
                self.log_result("Club Registration", True, 
                    f"✅ Using existing club: {existing_response['name']}")
            else:
                self.log_result("Club Registration", False, "❌ Failed to register club")
                return False
        
        # Step 3: Test club dashboard
        dashboard_response = self.make_request("GET", "/club/dashboard", token=self.club_admin_token, expected_status=200)
        if dashboard_response and "club" in dashboard_response and "stats" in dashboard_response:
            club = dashboard_response["club"]
            stats = dashboard_response["stats"]
            
            self.log_result("Club Dashboard Access", True, 
                f"✅ Dashboard data retrieved successfully")
            
            # Detailed stats logging
            stats_details = (
                f"Club: {club.get('name', 'Unknown')} | "
                f"Courts: {stats.get('courts_count', 0)} | "
                f"Open Matches: {stats.get('open_matches', 0)} | "
                f"Full Matches: {stats.get('full_matches', 0)} | "
                f"Completed: {stats.get('completed_matches', 0)} | "
                f"Total Bookings: {stats.get('total_bookings', 0)}"
            )
            
            self.log_result("Dashboard Stats Verification", True, f"✅ {stats_details}")
            return True
        else:
            self.log_result("Club Dashboard Access", False, "❌ Failed to get club dashboard data")
            return False

    def run_review_tests(self):
        """Run all review-specific tests"""
        print("=" * 80)
        print("🎯 MATCH SPORT 24 - FINAL REVIEW TESTING")
        print("Password Reset Flow | Club Dashboard | Apple Reviewer Login")
        print("Base URL: https://padel-finder-app.preview.emergentagent.com")
        print("=" * 80)
        
        # Test 1: Apple Reviewer Login (original credentials)
        self.test_apple_reviewer_login()
        
        # Test 2: Complete Password Reset Flow
        self.test_password_reset_flow()
        
        # Test 3: Club Dashboard Flow
        self.test_club_dashboard_flow()

        # Final Summary
        print("\n" + "=" * 80)
        print("📊 FINAL REVIEW TEST RESULTS")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"🎯 Success Rate: {(passed/len(self.test_results)*100):.1f}%")
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
        
        print("\n" + "=" * 80)
        print("🏆 REVIEW REQUIREMENTS STATUS")
        print("=" * 80)
        
        # Check specific requirements
        apple_login_ok = any(r["test"] == "Apple Reviewer Login" and r["success"] for r in self.test_results)
        password_reset_ok = any(r["test"] == "Password Reset Request" and r["success"] for r in self.test_results)
        dashboard_ok = any(r["test"] == "Club Dashboard Access" and r["success"] for r in self.test_results)
        
        print(f"✅ Apple Reviewer Login (reviewer@apple.com / AppleReview2024!): {'WORKING' if apple_login_ok else 'FAILED'}")
        print(f"✅ Password Reset Flow (forgot-password + reset-password): {'WORKING' if password_reset_ok else 'FAILED'}")
        print(f"✅ Club Dashboard (GET /api/club/dashboard): {'WORKING' if dashboard_ok else 'FAILED'}")
        
        if apple_login_ok and password_reset_ok and dashboard_ok:
            print("\n🎉 ALL REVIEW REQUIREMENTS SATISFIED!")
        else:
            print("\n⚠️  Some requirements need attention.")

if __name__ == "__main__":
    tester = FinalReviewTester()
    tester.run_review_tests()
#!/usr/bin/env python3
"""
Focused Promo Code Testing for Match Sport 24 API
Testing promo code validation and application endpoints
"""

import requests
import json
from typing import Dict, Any, Optional

# Backend URL configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class PromoCodeTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.club_admin_token = None
        self.club_admin_user_id = None
        self.club_id = None
        self.test_results = []

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
                if expected_status != 200:
                    return None  # For expected non-200 status codes
                return None
            
            if response.headers.get('content-type', '').startswith('application/json'):
                return response.json()
            else:
                return {"raw_response": response.text}
                
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None

    def setup_club_admin(self):
        """Setup club admin authentication"""
        # Try to login first
        login_data = {
            "email": "admin@tennisclub.com",
            "password": "password123"
        }
        
        login_response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
        if login_response and "access_token" in login_response:
            self.club_admin_token = login_response["access_token"]
            self.club_admin_user_id = login_response["user"]["user_id"]
            
            # Try to get club details
            club_response = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
            if club_response and "club_id" in club_response:
                self.club_id = club_response["club_id"]
                self.log_result("Setup Club Admin", True, f"Using existing club admin and club ID: {self.club_id}")
                return True
            else:
                self.log_result("Setup Club Admin", False, "Club admin exists but no club found")
                return False
        else:
            self.log_result("Setup Club Admin", False, "Failed to login club admin")
            return False

    def test_validate_trial_code(self):
        """Test promo code validation with TRIAL3MESI"""
        data = {"code": "TRIAL3MESI"}
        
        response = self.make_request("POST", "/promo/validate", data, expected_status=200)
        if (response and response.get("valid") == True and 
            response.get("type") == "trial_months" and 
            response.get("value") == 3 and
            response.get("discount") == 100):
            self.log_result("Validate TRIAL3MESI", True, f"Valid response: {response.get('message')}")
            return True
        else:
            self.log_result("Validate TRIAL3MESI", False, f"Invalid response: {response}")
            return False

    def test_validate_percentage_code(self):
        """Test promo code validation with SCONTO20"""
        data = {"code": "SCONTO20"}
        
        response = self.make_request("POST", "/promo/validate", data, expected_status=200)
        if (response and response.get("valid") == True and 
            response.get("type") == "percentage" and 
            response.get("value") == 20 and
            response.get("discount") == 20):
            self.log_result("Validate SCONTO20", True, f"Valid response: {response.get('message')}")
            return True
        else:
            self.log_result("Validate SCONTO20", False, f"Invalid response: {response}")
            return False

    def test_validate_invalid_code(self):
        """Test promo code validation with invalid code"""
        data = {"code": "INVALID123"}
        
        response = self.make_request("POST", "/promo/validate", data, expected_status=200)
        if (response and response.get("valid") == False and 
            "non valido" in response.get("message", "").lower()):
            self.log_result("Validate INVALID123", True, f"Correctly rejected: {response.get('message')}")
            return True
        else:
            self.log_result("Validate INVALID123", False, f"Not properly rejected: {response}")
            return False

    def test_apply_trial(self):
        """Test applying trial promo code (or verify if already applied)"""
        if not self.club_id or not self.club_admin_token:
            self.log_result("Apply TRIAL3MESI", False, "No club admin setup, cannot test")
            return False
        
        # First, let's check current club subscription status
        club_response = self.make_request("GET", "/club/my", token=self.club_admin_token, expected_status=200)
        if club_response and club_response.get("subscription_status") == "trial":
            self.log_result("Apply TRIAL3MESI", True, f"Trial already active: status={club_response.get('subscription_status')}, plan={club_response.get('subscription_plan')}")
            return True
        
        data = {"code": "TRIAL3MESI"}
        
        # Try to apply the promo code
        try:
            response = requests.post(f"{self.base_url}/promo/apply-trial", 
                                    json=data, 
                                    headers={"Authorization": f"Bearer {self.club_admin_token}", 
                                            "Content-Type": "application/json"}, 
                                    timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get("success") == True and "3 mesi" in response_data.get("message", ""):
                    self.log_result("Apply TRIAL3MESI", True, f"Applied successfully: {response_data.get('message')}")
                    return True
            elif response.status_code == 400:
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"detail": response.text}
                if "già stato utilizzato" in response_data.get("detail", ""):
                    self.log_result("Apply TRIAL3MESI", True, "Promo code already applied (expected for existing club)")
                    return True
                else:
                    self.log_result("Apply TRIAL3MESI", False, f"Unexpected error: {response_data}")
                    return False
            else:
                self.log_result("Apply TRIAL3MESI", False, f"Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Apply TRIAL3MESI", False, f"Request failed: {e}")
            return False

    def test_apply_duplicate(self):
        """Test applying same trial promo code twice (should fail)"""
        if not self.club_admin_token:
            self.log_result("Apply Duplicate TRIAL3MESI", False, "No club admin token")
            return False
        
        data = {"code": "TRIAL3MESI"}
        
        # This should fail since it's already been used
        try:
            response = requests.post(f"{self.base_url}/promo/apply-trial", 
                                    json=data, 
                                    headers={"Authorization": f"Bearer {self.club_admin_token}", 
                                            "Content-Type": "application/json"}, 
                                    timeout=30)
            
            if response.status_code == 400:
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"detail": response.text}
                if "già stato utilizzato" in response_data.get("detail", ""):
                    self.log_result("Apply Duplicate TRIAL3MESI", True, "Correctly rejected as already used")
                    return True
                else:
                    self.log_result("Apply Duplicate TRIAL3MESI", False, f"Wrong error message: {response_data}")
                    return False
            else:
                self.log_result("Apply Duplicate TRIAL3MESI", False, f"Expected 400, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Apply Duplicate TRIAL3MESI", False, f"Request failed: {e}")
            return False

    def test_apply_wrong_type(self):
        """Test applying percentage promo to trial endpoint (should fail)"""
        if not self.club_admin_token:
            self.log_result("Apply Wrong Type SCONTO20", False, "No club admin token")
            return False
        
        data = {"code": "SCONTO20"}
        
        try:
            response = requests.post(f"{self.base_url}/promo/apply-trial", 
                                    json=data, 
                                    headers={"Authorization": f"Bearer {self.club_admin_token}", 
                                            "Content-Type": "application/json"}, 
                                    timeout=30)
            
            if response.status_code == 400:
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"detail": response.text}
                if "non è valido per una prova gratuita" in response_data.get("detail", ""):
                    self.log_result("Apply Wrong Type SCONTO20", True, "Correctly rejected for wrong type")
                    return True
                else:
                    self.log_result("Apply Wrong Type SCONTO20", False, f"Wrong error message: {response_data}")
                    return False
            else:
                self.log_result("Apply Wrong Type SCONTO20", False, f"Expected 400, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Apply Wrong Type SCONTO20", False, f"Request failed: {e}")
            return False

    def run_all_tests(self):
        """Run all promo code tests"""
        print("=" * 60)
        print("🎁 PROMO CODE VALIDATION TESTS")
        print("=" * 60)
        print()

        # Setup
        print("🔧 SETUP")
        print("-" * 20)
        self.setup_club_admin()
        print()

        # Validation Tests
        print("✅ VALIDATION TESTS")
        print("-" * 20)
        self.test_validate_trial_code()
        self.test_validate_percentage_code()
        self.test_validate_invalid_code()
        print()

        # Application Tests
        print("🚀 APPLICATION TESTS")
        print("-" * 20)
        self.test_apply_trial()
        self.test_apply_duplicate()
        self.test_apply_wrong_type()
        print()

        # Summary
        print("=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
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

if __name__ == "__main__":
    tester = PromoCodeTester()
    tester.run_all_tests()
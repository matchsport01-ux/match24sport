#!/usr/bin/env python3
"""
DELETE ACCOUNT Feature Testing for Match Sport 24 - Apple App Store Compliance
Testing the DELETE ACCOUNT functionality as requested in the review.

This is CRITICAL for Apple App Store compliance per Guideline 5.1.1(v).

TEST FLOW:
1. Create test user for deletion
2. Delete account with wrong password (should fail)
3. Delete account with correct password (should succeed)
4. Verify user is deleted (login should fail)
5. Verify old token is invalid
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class DeleteAccountTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.test_user_token = None
        self.test_user_email = None
        self.test_user_password = None
        
    def log_test(self, test_name: str, endpoint: str, status_code: int, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test_name": test_name,
            "endpoint": endpoint,
            "status_code": status_code,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {endpoint} -> {status_code} | {details}")
        
    def test_1_create_test_user_for_deletion(self) -> bool:
        """TEST 1: Create a NEW test user for deletion"""
        print("\n🎯 TEST 1: CREATE TEST USER FOR DELETION")
        
        # Generate unique email for this test
        timestamp = int(time.time())
        self.test_user_email = f"test_delete_user_{timestamp}@example.com"
        self.test_user_password = "TestDelete123!"
        
        user_data = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": "Test Delete User",
            "role": "player"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/register", json=user_data)
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.test_user_token = data.get("access_token")
                
                if self.test_user_token:
                    self.log_test("Create Test User", "/auth/register", response.status_code, True, 
                                f"User created: {self.test_user_email}, token obtained")
                    return True
                else:
                    self.log_test("Create Test User", "/auth/register", response.status_code, False, 
                                "Registration successful but no access_token in response")
                    return False
            else:
                self.log_test("Create Test User", "/auth/register", response.status_code, False, 
                            f"Registration failed: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Test User", "/auth/register", 0, False, f"Exception: {str(e)}")
            return False
            
    def test_1b_verify_user_exists(self) -> bool:
        """TEST 1B: Verify the user exists by calling /auth/me"""
        print("\n🎯 TEST 1B: VERIFY USER EXISTS")
        
        if not self.test_user_token:
            self.log_test("Verify User Exists", "/auth/me", 0, False, "No token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.test_user_token}", "Content-Type": "application/json"}
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                if user_data.get("email") == self.test_user_email:
                    self.log_test("Verify User Exists", "/auth/me", 200, True, 
                                f"User verified: {user_data.get('name')} ({user_data.get('email')})")
                    return True
                else:
                    self.log_test("Verify User Exists", "/auth/me", 200, False, 
                                f"Email mismatch: expected {self.test_user_email}, got {user_data.get('email')}")
                    return False
            else:
                self.log_test("Verify User Exists", "/auth/me", response.status_code, False, 
                            f"Failed to get user info: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify User Exists", "/auth/me", 0, False, f"Exception: {str(e)}")
            return False
            
    def test_2_delete_account_wrong_password(self) -> bool:
        """TEST 2: Delete account with WRONG password (should fail)"""
        print("\n🎯 TEST 2: DELETE ACCOUNT - WRONG PASSWORD")
        
        if not self.test_user_token:
            self.log_test("Delete Wrong Password", "/auth/delete-account", 0, False, "No token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.test_user_token}", "Content-Type": "application/json"}
        delete_data = {
            "password": "WrongPassword123!",
            "confirmation": "DELETE"
        }
        
        try:
            response = self.session.delete(f"{BASE_URL}/auth/delete-account", json=delete_data, headers=headers)
            
            if response.status_code == 401:
                response_data = response.json()
                if "Incorrect password" in response_data.get("detail", ""):
                    self.log_test("Delete Wrong Password", "/auth/delete-account", 401, True, 
                                "Correctly rejected wrong password with 'Incorrect password' message")
                    return True
                else:
                    self.log_test("Delete Wrong Password", "/auth/delete-account", 401, False, 
                                f"Wrong error message: {response_data.get('detail')}")
                    return False
            else:
                self.log_test("Delete Wrong Password", "/auth/delete-account", response.status_code, False, 
                            f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Wrong Password", "/auth/delete-account", 0, False, f"Exception: {str(e)}")
            return False
            
    def test_3_delete_account_correct_password(self) -> bool:
        """TEST 3: Delete account with CORRECT password (should succeed)"""
        print("\n🎯 TEST 3: DELETE ACCOUNT - CORRECT PASSWORD")
        
        if not self.test_user_token:
            self.log_test("Delete Correct Password", "/auth/delete-account", 0, False, "No token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.test_user_token}", "Content-Type": "application/json"}
        delete_data = {
            "password": self.test_user_password,
            "confirmation": "DELETE"
        }
        
        try:
            response = self.session.delete(f"{BASE_URL}/auth/delete-account", json=delete_data, headers=headers)
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get("success") is True:
                    self.log_test("Delete Correct Password", "/auth/delete-account", 200, True, 
                                f"Account deleted successfully: {response_data.get('message')}")
                    return True
                else:
                    self.log_test("Delete Correct Password", "/auth/delete-account", 200, False, 
                                f"Success field not true: {response_data}")
                    return False
            else:
                self.log_test("Delete Correct Password", "/auth/delete-account", response.status_code, False, 
                            f"Expected 200, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Correct Password", "/auth/delete-account", 0, False, f"Exception: {str(e)}")
            return False
            
    def test_4_verify_user_is_deleted(self) -> bool:
        """TEST 4: Verify user is deleted by trying to login"""
        print("\n🎯 TEST 4: VERIFY USER IS DELETED")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 401:
                response_data = response.json()
                # Check for user not found or invalid credentials
                detail = response_data.get("detail", "").lower()
                if "invalid" in detail or "not found" in detail or "incorrect" in detail:
                    self.log_test("Verify User Deleted", "/auth/login", 401, True, 
                                f"Login correctly failed: {response_data.get('detail')}")
                    return True
                else:
                    self.log_test("Verify User Deleted", "/auth/login", 401, False, 
                                f"Unexpected error message: {response_data.get('detail')}")
                    return False
            else:
                self.log_test("Verify User Deleted", "/auth/login", response.status_code, False, 
                            f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify User Deleted", "/auth/login", 0, False, f"Exception: {str(e)}")
            return False
            
    def test_5_verify_old_token_invalid(self) -> bool:
        """TEST 5: Verify old token is invalid"""
        print("\n🎯 TEST 5: VERIFY OLD TOKEN IS INVALID")
        
        if not self.test_user_token:
            self.log_test("Verify Old Token Invalid", "/auth/me", 0, False, "No token to test")
            return False
            
        headers = {"Authorization": f"Bearer {self.test_user_token}", "Content-Type": "application/json"}
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 401:
                response_data = response.json()
                detail = response_data.get("detail", "").lower()
                if "unauthorized" in detail or "invalid" in detail or "token" in detail or "user not found" in detail:
                    self.log_test("Verify Old Token Invalid", "/auth/me", 401, True, 
                                f"Token correctly invalidated: {response_data.get('detail')}")
                    return True
                else:
                    self.log_test("Verify Old Token Invalid", "/auth/me", 401, False, 
                                f"Unexpected error message: {response_data.get('detail')}")
                    return False
            else:
                self.log_test("Verify Old Token Invalid", "/auth/me", response.status_code, False, 
                            f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify Old Token Invalid", "/auth/me", 0, False, f"Exception: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all DELETE ACCOUNT tests"""
        print("🚀 STARTING DELETE ACCOUNT TESTING FOR APPLE APP STORE COMPLIANCE")
        print("=" * 80)
        print(f"Base URL: {BASE_URL}")
        print("Testing DELETE ACCOUNT feature per Apple Guideline 5.1.1(v)")
        print("=" * 80)
        
        test_functions = [
            ("Create Test User for Deletion", self.test_1_create_test_user_for_deletion),
            ("Verify User Exists", self.test_1b_verify_user_exists),
            ("Delete Account - Wrong Password", self.test_2_delete_account_wrong_password),
            ("Delete Account - Correct Password", self.test_3_delete_account_correct_password),
            ("Verify User is Deleted", self.test_4_verify_user_is_deleted),
            ("Verify Old Token is Invalid", self.test_5_verify_old_token_invalid)
        ]
        
        passed_tests = 0
        total_tests = len(test_functions)
        
        for test_name, test_func in test_functions:
            print(f"\n{'='*60}")
            print(f"RUNNING: {test_name}")
            print(f"{'='*60}")
            
            try:
                success = test_func()
                if success:
                    passed_tests += 1
                    print(f"✅ {test_name} - PASSED")
                else:
                    print(f"❌ {test_name} - FAILED")
                    # If a critical test fails, we might want to continue to see all results
                    
            except Exception as e:
                print(f"❌ {test_name} - EXCEPTION: {str(e)}")
                
        # Print summary
        print(f"\n{'='*80}")
        print(f"DELETE ACCOUNT TEST SUMMARY: {passed_tests}/{total_tests} TESTS PASSED")
        print(f"{'='*80}")
        
        # Print detailed results
        print("\n📊 DETAILED TEST RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test_name']}: {result['endpoint']} -> {result['status_code']} | {result['details']}")
            
        # Print expected results summary
        print(f"\n📋 EXPECTED RESULTS VERIFICATION:")
        print(f"✅ Registration: Expected 200/201 - {'PASS' if any(r['test_name'] == 'Create Test User' and r['success'] for r in self.test_results) else 'FAIL'}")
        print(f"✅ Delete with wrong password: Expected 401 - {'PASS' if any(r['test_name'] == 'Delete Wrong Password' and r['success'] for r in self.test_results) else 'FAIL'}")
        print(f"✅ Delete with correct password: Expected 200 with success:true - {'PASS' if any(r['test_name'] == 'Delete Correct Password' and r['success'] for r in self.test_results) else 'FAIL'}")
        print(f"✅ Login after deletion: Expected 401 - {'PASS' if any(r['test_name'] == 'Verify User Deleted' and r['success'] for r in self.test_results) else 'FAIL'}")
        print(f"✅ Old token after deletion: Expected 401 - {'PASS' if any(r['test_name'] == 'Verify Old Token Invalid' and r['success'] for r in self.test_results) else 'FAIL'}")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = DeleteAccountTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
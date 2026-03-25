#!/usr/bin/env python3
"""
Backend API Testing for Match Sport 24 - IAP Subscription Endpoints
Testing the NEW In-App Purchase (IAP) subscription endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"
CLUB_ADMIN_EMAIL = "newclubtest6051@test.com"
CLUB_ADMIN_PASSWORD = "TestPass123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_test(test_name, status, details=""):
    """Log test results with colors"""
    color = Colors.GREEN if status == "PASS" else Colors.RED
    print(f"{color}[{status}]{Colors.ENDC} {Colors.BOLD}{test_name}{Colors.ENDC}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, headers=None, data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"{Colors.RED}Request failed: {e}{Colors.ENDC}")
        return None

def test_club_admin_login():
    """Test club admin login to get authentication token"""
    print(f"{Colors.BLUE}=== TESTING CLUB ADMIN LOGIN ==={Colors.ENDC}")
    
    login_data = {
        "email": CLUB_ADMIN_EMAIL,
        "password": CLUB_ADMIN_PASSWORD
    }
    
    response = make_request("POST", "/auth/login", data=login_data)
    
    if not response:
        log_test("Club Admin Login", "FAIL", "Request failed")
        return None
    
    if response.status_code == 200:
        try:
            data = response.json()
            if "access_token" in data:
                log_test("Club Admin Login", "PASS", f"Token received, user role: {data.get('user', {}).get('role', 'unknown')}")
                return data["access_token"]
            else:
                log_test("Club Admin Login", "FAIL", "No access_token in response")
                return None
        except json.JSONDecodeError:
            log_test("Club Admin Login", "FAIL", "Invalid JSON response")
            return None
    else:
        log_test("Club Admin Login", "FAIL", f"HTTP {response.status_code}: {response.text}")
        return None

def test_iap_validate_endpoint(token):
    """Test IAP Validate Endpoint"""
    print(f"{Colors.BLUE}=== TEST 1: IAP VALIDATE ENDPOINT ==={Colors.ENDC}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test data as specified in review request
    iap_data = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": "test_transaction_12345",
        "receipt": "test_receipt_data",
        "plan_id": "monthly"
    }
    
    response = make_request("POST", "/subscription/iap/validate", headers=headers, data=iap_data)
    
    if not response:
        log_test("IAP Validate Endpoint", "FAIL", "Request failed")
        return False
    
    print(f"    HTTP Status: {response.status_code}")
    print(f"    Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        try:
            data = response.json()
            if data.get("success") == True:
                log_test("IAP Validate Endpoint", "PASS", f"Success: {data.get('success')}, Subscription activated")
                return True
            else:
                log_test("IAP Validate Endpoint", "FAIL", f"Success field not true: {data}")
                return False
        except json.JSONDecodeError:
            log_test("IAP Validate Endpoint", "FAIL", "Invalid JSON response")
            return False
    else:
        log_test("IAP Validate Endpoint", "FAIL", f"HTTP {response.status_code}")
        return False

def test_iap_status_endpoint(token):
    """Test IAP Status Endpoint"""
    print(f"{Colors.BLUE}=== TEST 2: IAP STATUS ENDPOINT ==={Colors.ENDC}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = make_request("GET", "/subscription/iap/status", headers=headers)
    
    if not response:
        log_test("IAP Status Endpoint", "FAIL", "Request failed")
        return False
    
    print(f"    HTTP Status: {response.status_code}")
    print(f"    Response: {response.text[:300]}...")
    
    if response.status_code == 200:
        try:
            data = response.json()
            required_fields = ["subscription_status", "subscription_plan", "is_active"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                log_test("IAP Status Endpoint", "PASS", f"All required fields present: {required_fields}")
                return True
            else:
                log_test("IAP Status Endpoint", "FAIL", f"Missing fields: {missing_fields}")
                return False
        except json.JSONDecodeError:
            log_test("IAP Status Endpoint", "FAIL", "Invalid JSON response")
            return False
    else:
        log_test("IAP Status Endpoint", "FAIL", f"HTTP {response.status_code}")
        return False

def test_iap_restore_endpoint(token):
    """Test IAP Restore Endpoint"""
    print(f"{Colors.BLUE}=== TEST 3: IAP RESTORE ENDPOINT ==={Colors.ENDC}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = make_request("POST", "/subscription/iap/restore", headers=headers)
    
    if not response:
        log_test("IAP Restore Endpoint", "FAIL", "Request failed")
        return False
    
    print(f"    HTTP Status: {response.status_code}")
    print(f"    Response: {response.text[:300]}...")
    
    if response.status_code == 200:
        try:
            data = response.json()
            # Should return subscription info or "no purchases to restore" message
            if "subscription_status" in data or "message" in data:
                log_test("IAP Restore Endpoint", "PASS", "Valid response structure")
                return True
            else:
                log_test("IAP Restore Endpoint", "FAIL", f"Unexpected response structure: {data}")
                return False
        except json.JSONDecodeError:
            log_test("IAP Restore Endpoint", "FAIL", "Invalid JSON response")
            return False
    else:
        log_test("IAP Restore Endpoint", "FAIL", f"HTTP {response.status_code}")
        return False

def test_duplicate_transaction_prevention(token):
    """Test Duplicate Transaction Prevention"""
    print(f"{Colors.BLUE}=== TEST 4: DUPLICATE TRANSACTION PREVENTION ==={Colors.ENDC}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Same test data as first test to check duplicate prevention
    iap_data = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": "test_transaction_12345",  # Same transaction ID
        "receipt": "test_receipt_data",
        "plan_id": "monthly"
    }
    
    response = make_request("POST", "/subscription/iap/validate", headers=headers, data=iap_data)
    
    if not response:
        log_test("Duplicate Transaction Prevention", "FAIL", "Request failed")
        return False
    
    print(f"    HTTP Status: {response.status_code}")
    print(f"    Response: {response.text[:300]}...")
    
    if response.status_code == 200:
        try:
            data = response.json()
            if data.get("already_processed") == True:
                log_test("Duplicate Transaction Prevention", "PASS", "Duplicate transaction correctly detected")
                return True
            else:
                log_test("Duplicate Transaction Prevention", "FAIL", f"Expected already_processed: true, got: {data}")
                return False
        except json.JSONDecodeError:
            log_test("Duplicate Transaction Prevention", "FAIL", "Invalid JSON response")
            return False
    else:
        log_test("Duplicate Transaction Prevention", "FAIL", f"HTTP {response.status_code}")
        return False

def main():
    """Main testing function"""
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}MATCH SPORT 24 - IAP SUBSCRIPTION ENDPOINTS TESTING{Colors.ENDC}")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Credentials: {CLUB_ADMIN_EMAIL}")
    print()
    
    # Step 1: Login as club admin
    token = test_club_admin_login()
    if not token:
        print(f"{Colors.RED}CRITICAL: Cannot proceed without authentication token{Colors.ENDC}")
        sys.exit(1)
    
    # Step 2: Test all IAP endpoints
    test_results = []
    
    test_results.append(test_iap_validate_endpoint(token))
    test_results.append(test_iap_status_endpoint(token))
    test_results.append(test_iap_restore_endpoint(token))
    test_results.append(test_duplicate_transaction_prevention(token))
    
    # Summary
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}TESTING SUMMARY{Colors.ENDC}")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"Tests Passed: {Colors.GREEN}{passed}{Colors.ENDC}/{total}")
    print(f"Success Rate: {Colors.GREEN if passed == total else Colors.YELLOW}{(passed/total)*100:.1f}%{Colors.ENDC}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}🎉 ALL IAP SUBSCRIPTION ENDPOINTS WORKING CORRECTLY!{Colors.ENDC}")
    else:
        print(f"\n{Colors.RED}❌ SOME TESTS FAILED - REVIEW REQUIRED{Colors.ENDC}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
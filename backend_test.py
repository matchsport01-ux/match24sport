#!/usr/bin/env python3
"""
IAP Subscription Backend Testing Script
Tests the In-App Purchase subscription endpoints for Match Sport 24 app.
"""

import requests
import json
import uuid
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

# Test credentials
CLUB_USER = {
    "email": "newclubtest6051@test.com",
    "password": "TestPass123!"
}

APPLE_DEMO = {
    "email": "reviewer@apple.com", 
    "password": "AppleReview2024!"
}

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}: {status}")
    if details:
        print(f"    {details}")

def login_user(credentials):
    """Login and return access token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=credentials,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            log_test(f"Login {credentials['email']}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test(f"Login {credentials['email']}", "FAIL", f"Exception: {str(e)}")
        return None

def test_iap_validate_endpoint():
    """Test POST /api/subscription/iap/validate endpoint"""
    print("\n🎯 TESTING IAP VALIDATE ENDPOINT")
    
    # Login as club user
    token = login_user(CLUB_USER)
    if not token:
        log_test("IAP Validate - Login", "FAIL", "Could not login as club user")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test 1: iOS platform validation
    ios_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_transaction_{uuid.uuid4().hex[:8]}",
        "receipt": "test_receipt_data_ios",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=ios_request,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "subscription_status" in data:
                log_test("IAP Validate iOS", "PASS", f"Response: {json.dumps(data, indent=2)}")
                return True, ios_request["transaction_id"]
            else:
                log_test("IAP Validate iOS", "FAIL", f"Invalid response structure: {data}")
                return False, None
        else:
            log_test("IAP Validate iOS", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False, None
            
    except Exception as e:
        log_test("IAP Validate iOS", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_iap_validate_android():
    """Test Android platform validation"""
    token = login_user(CLUB_USER)
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test Android platform validation
    android_request = {
        "platform": "android",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_transaction_android_{uuid.uuid4().hex[:8]}",
        "receipt": "test_purchase_token_android",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=android_request,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "subscription_status" in data:
                log_test("IAP Validate Android", "PASS", f"Platform: {android_request['platform']}, Plan: {android_request['plan_id']}")
                return True
            else:
                log_test("IAP Validate Android", "FAIL", f"Invalid response structure: {data}")
                return False
        else:
            log_test("IAP Validate Android", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("IAP Validate Android", "FAIL", f"Exception: {str(e)}")
        return False

def test_iap_status_endpoint():
    """Test GET /api/subscription/iap/status endpoint"""
    print("\n🎯 TESTING IAP STATUS ENDPOINT")
    
    token = login_user(CLUB_USER)
    if not token:
        log_test("IAP Status - Login", "FAIL", "Could not login as club user")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{BASE_URL}/subscription/iap/status",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["subscription_status", "subscription_plan", "subscription_expires_at", "subscription_source", "is_active"]
            
            if all(field in data for field in required_fields):
                log_test("IAP Status", "PASS", f"All required fields present: {list(data.keys())}")
                log_test("IAP Status Details", "INFO", f"Status: {data.get('subscription_status')}, Plan: {data.get('subscription_plan')}, Active: {data.get('is_active')}")
                return True
            else:
                missing_fields = [field for field in required_fields if field not in required_fields]
                log_test("IAP Status", "FAIL", f"Missing fields: {missing_fields}")
                return False
        else:
            log_test("IAP Status", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("IAP Status", "FAIL", f"Exception: {str(e)}")
        return False

def test_iap_restore_endpoint():
    """Test POST /api/subscription/iap/restore endpoint"""
    print("\n🎯 TESTING IAP RESTORE ENDPOINT")
    
    token = login_user(CLUB_USER)
    if not token:
        log_test("IAP Restore - Login", "FAIL", "Could not login as club user")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/restore",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if "success" in data and "message" in data:
                log_test("IAP Restore", "PASS", f"Response: {data.get('message')}")
                log_test("IAP Restore Details", "INFO", f"Success: {data.get('success')}, Status: {data.get('subscription_status')}")
                return True
            else:
                log_test("IAP Restore", "FAIL", f"Invalid response structure: {data}")
                return False
        else:
            log_test("IAP Restore", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("IAP Restore", "FAIL", f"Exception: {str(e)}")
        return False

def test_duplicate_transaction_prevention():
    """Test duplicate transaction prevention"""
    print("\n🎯 TESTING DUPLICATE TRANSACTION PREVENTION")
    
    token = login_user(CLUB_USER)
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Use the same transaction ID twice
    transaction_id = f"test_duplicate_{uuid.uuid4().hex[:8]}"
    
    duplicate_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": transaction_id,
        "receipt": "test_receipt_duplicate",
        "plan_id": "monthly"
    }
    
    try:
        # First request - should succeed
        response1 = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=duplicate_request,
            headers=headers
        )
        
        # Second request with same transaction_id - should detect duplicate
        response2 = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=duplicate_request,
            headers=headers
        )
        
        if response1.status_code == 200 and response2.status_code == 200:
            data2 = response2.json()
            if data2.get("already_processed"):
                log_test("Duplicate Transaction Prevention", "PASS", f"Duplicate detected: {data2.get('message')}")
                return True
            else:
                log_test("Duplicate Transaction Prevention", "FAIL", "Duplicate not detected")
                return False
        else:
            log_test("Duplicate Transaction Prevention", "FAIL", f"Request failed: {response1.status_code}, {response2.status_code}")
            return False
            
    except Exception as e:
        log_test("Duplicate Transaction Prevention", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all IAP subscription tests"""
    print("=" * 80)
    print("🚀 IAP SUBSCRIPTION BACKEND TESTING STARTED")
    print("=" * 80)
    
    test_results = []
    
    # Test 1: IAP Validate Endpoint (iOS)
    result1, transaction_id = test_iap_validate_endpoint()
    test_results.append(("IAP Validate iOS", result1))
    
    # Test 2: IAP Validate Endpoint (Android)
    result2 = test_iap_validate_android()
    test_results.append(("IAP Validate Android", result2))
    
    # Test 3: IAP Status Endpoint
    result3 = test_iap_status_endpoint()
    test_results.append(("IAP Status", result3))
    
    # Test 4: IAP Restore Endpoint
    result4 = test_iap_restore_endpoint()
    test_results.append(("IAP Restore", result4))
    
    # Test 5: Duplicate Transaction Prevention
    result5 = test_duplicate_transaction_prevention()
    test_results.append(("Duplicate Prevention", result5))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🏆 OVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL IAP SUBSCRIPTION ENDPOINTS ARE FULLY FUNCTIONAL!")
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    main()
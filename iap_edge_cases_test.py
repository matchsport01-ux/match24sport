#!/usr/bin/env python3
"""
IAP Edge Cases Testing
Tests edge cases for IAP endpoints including invalid platforms, missing fields, etc.
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

# Test credentials
CLUB_USER = {
    "email": "newclubtest6051@test.com",
    "password": "TestPass123!"
}

PLAYER_USER = {
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
            return None
    except Exception as e:
        return None

def test_invalid_platform():
    """Test IAP validation with invalid platform"""
    print("\n🎯 TESTING INVALID PLATFORM REJECTION")
    
    token = login_user(CLUB_USER)
    if not token:
        log_test("Invalid Platform - Login", "FAIL", "Could not login")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    invalid_request = {
        "platform": "windows",  # Invalid platform
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_invalid_{uuid.uuid4().hex[:8]}",
        "receipt": "test_receipt",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=invalid_request,
            headers=headers
        )
        
        if response.status_code == 400:
            data = response.json()
            if "Piattaforma non supportata" in data.get("detail", ""):
                log_test("Invalid Platform Rejection", "PASS", f"Correctly rejected: {data.get('detail')}")
                return True
            else:
                log_test("Invalid Platform Rejection", "FAIL", f"Wrong error message: {data.get('detail')}")
                return False
        else:
            log_test("Invalid Platform Rejection", "FAIL", f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Invalid Platform Rejection", "FAIL", f"Exception: {str(e)}")
        return False

def test_missing_fields():
    """Test IAP validation with missing required fields"""
    print("\n🎯 TESTING MISSING FIELDS REJECTION")
    
    token = login_user(CLUB_USER)
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Missing transaction_id
    incomplete_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        # "transaction_id": missing
        "receipt": "test_receipt",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=incomplete_request,
            headers=headers
        )
        
        if response.status_code == 422:  # Validation error
            log_test("Missing Fields Rejection", "PASS", f"Correctly rejected missing fields: {response.status_code}")
            return True
        else:
            log_test("Missing Fields Rejection", "FAIL", f"Expected 422, got {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Missing Fields Rejection", "FAIL", f"Exception: {str(e)}")
        return False

def test_player_access_restriction():
    """Test that player accounts cannot access IAP endpoints"""
    print("\n🎯 TESTING PLAYER ACCESS RESTRICTION")
    
    token = login_user(PLAYER_USER)
    if not token:
        log_test("Player Access - Login", "FAIL", "Could not login as player")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    valid_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_player_{uuid.uuid4().hex[:8]}",
        "receipt": "test_receipt",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=valid_request,
            headers=headers
        )
        
        if response.status_code == 400:
            data = response.json()
            if "Solo i circoli possono sottoscrivere abbonamenti" in data.get("detail", ""):
                log_test("Player Access Restriction", "PASS", f"Correctly rejected player: {data.get('detail')}")
                return True
            else:
                log_test("Player Access Restriction", "FAIL", f"Wrong error message: {data.get('detail')}")
                return False
        else:
            log_test("Player Access Restriction", "FAIL", f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Player Access Restriction", "FAIL", f"Exception: {str(e)}")
        return False

def test_italian_error_messages():
    """Test that error messages are in Italian"""
    print("\n🎯 TESTING ITALIAN ERROR MESSAGES")
    
    token = login_user(CLUB_USER)
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test with invalid plan_id
    invalid_plan_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_invalid_plan_{uuid.uuid4().hex[:8]}",
        "receipt": "test_receipt",
        "plan_id": "invalid_plan"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=invalid_plan_request,
            headers=headers
        )
        
        if response.status_code == 400:
            data = response.json()
            error_message = data.get("detail", "")
            
            # Check if error message is in Italian
            italian_keywords = ["Piano non valido", "non", "valido"]
            if any(keyword in error_message for keyword in italian_keywords):
                log_test("Italian Error Messages", "PASS", f"Italian error: {error_message}")
                return True
            else:
                log_test("Italian Error Messages", "FAIL", f"Non-Italian error: {error_message}")
                return False
        else:
            log_test("Italian Error Messages", "FAIL", f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Italian Error Messages", "FAIL", f"Exception: {str(e)}")
        return False

def test_monthly_subscription_duration():
    """Test that monthly subscription sets correct duration (1 month)"""
    print("\n🎯 TESTING MONTHLY SUBSCRIPTION DURATION")
    
    token = login_user(CLUB_USER)
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    monthly_request = {
        "platform": "ios",
        "product_id": "com.matchsport24.subscription.monthly",
        "transaction_id": f"test_monthly_{uuid.uuid4().hex[:8]}",
        "receipt": "test_receipt_monthly",
        "plan_id": "monthly"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/subscription/iap/validate",
            json=monthly_request,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            expires_at = data.get("subscription_expires_at")
            
            if expires_at:
                # Parse the expiration date
                from datetime import datetime, timezone
                expires_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                
                # Check if it's approximately 30 days (allow some tolerance)
                days_diff = (expires_date - now).days
                if 28 <= days_diff <= 32:  # Allow 28-32 days for monthly
                    log_test("Monthly Duration", "PASS", f"Correct duration: ~{days_diff} days")
                    return True
                else:
                    log_test("Monthly Duration", "FAIL", f"Wrong duration: {days_diff} days")
                    return False
            else:
                log_test("Monthly Duration", "FAIL", "No expiration date in response")
                return False
        else:
            log_test("Monthly Duration", "FAIL", f"Request failed: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Monthly Duration", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all edge case tests"""
    print("=" * 80)
    print("🚀 IAP EDGE CASES TESTING STARTED")
    print("=" * 80)
    
    test_results = []
    
    # Test 1: Invalid Platform
    result1 = test_invalid_platform()
    test_results.append(("Invalid Platform Rejection", result1))
    
    # Test 2: Missing Fields
    result2 = test_missing_fields()
    test_results.append(("Missing Fields Rejection", result2))
    
    # Test 3: Player Access Restriction
    result3 = test_player_access_restriction()
    test_results.append(("Player Access Restriction", result3))
    
    # Test 4: Italian Error Messages
    result4 = test_italian_error_messages()
    test_results.append(("Italian Error Messages", result4))
    
    # Test 5: Monthly Duration
    result5 = test_monthly_subscription_duration()
    test_results.append(("Monthly Duration", result5))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 EDGE CASES TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🏆 OVERALL RESULT: {passed}/{total} edge case tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL IAP EDGE CASES HANDLED CORRECTLY!")
    else:
        print("⚠️  Some edge case tests failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    main()
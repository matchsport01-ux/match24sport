#!/usr/bin/env python3
"""
Additional IAP Testing with Apple Demo Credentials
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

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

def test_apple_demo_iap_access():
    """Test IAP endpoints with Apple demo credentials"""
    print("\n🎯 TESTING IAP ACCESS WITH APPLE DEMO CREDENTIALS")
    
    # Login as Apple demo user
    token = login_user(APPLE_DEMO)
    if not token:
        log_test("Apple Demo Login", "FAIL", "Could not login as Apple demo user")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test IAP Status endpoint (should fail for player account)
    try:
        response = requests.get(
            f"{BASE_URL}/subscription/iap/status",
            headers=headers
        )
        
        if response.status_code == 400:
            log_test("Apple Demo IAP Status", "PASS", "Correctly rejected player account (400 Bad Request)")
            return True
        elif response.status_code == 200:
            log_test("Apple Demo IAP Status", "FAIL", "Should not allow player accounts to access IAP status")
            return False
        else:
            log_test("Apple Demo IAP Status", "FAIL", f"Unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Apple Demo IAP Status", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Test Apple demo credentials with IAP endpoints"""
    print("=" * 80)
    print("🍎 APPLE DEMO CREDENTIALS IAP TESTING")
    print("=" * 80)
    
    result = test_apple_demo_iap_access()
    
    print("\n" + "=" * 80)
    print("📊 APPLE DEMO TEST SUMMARY")
    print("=" * 80)
    
    if result:
        print("✅ PASS Apple Demo IAP Access Control")
        print("🎉 IAP endpoints correctly restrict access to club accounts only!")
    else:
        print("❌ FAIL Apple Demo IAP Access Control")
        print("⚠️  IAP access control may have issues.")

if __name__ == "__main__":
    main()
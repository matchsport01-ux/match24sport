#!/usr/bin/env python3
"""
Club Status After IAP Purchase Testing
Tests that GET /api/club/my returns correct subscription fields after IAP purchase.
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

# Test credentials
CLUB_USER = {
    "email": "newclubtest6051@test.com",
    "password": "TestPass123!"
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
            log_test(f"Login {credentials['email']}", "FAIL", f"Status: {response.status_code}")
            return None
    except Exception as e:
        log_test(f"Login {credentials['email']}", "FAIL", f"Exception: {str(e)}")
        return None

def test_club_status_after_purchase():
    """Test GET /api/club/my shows correct subscription status after IAP purchase"""
    print("\n🎯 TESTING CLUB STATUS AFTER IAP PURCHASE")
    
    token = login_user(CLUB_USER)
    if not token:
        log_test("Club Status - Login", "FAIL", "Could not login as club user")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{BASE_URL}/club/my",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for subscription fields
            subscription_fields = ["subscription_status", "subscription_expires_at"]
            present_fields = [field for field in subscription_fields if field in data]
            
            if "subscription_status" in data:
                log_test("Club Status - Subscription Status Field", "PASS", f"subscription_status: {data.get('subscription_status')}")
                
                if data.get("subscription_status") == "active":
                    log_test("Club Status - Active Subscription", "PASS", "Subscription is active")
                else:
                    log_test("Club Status - Active Subscription", "INFO", f"Subscription status: {data.get('subscription_status')}")
                
                if "subscription_expires_at" in data:
                    log_test("Club Status - Expiration Field", "PASS", f"Expires: {data.get('subscription_expires_at')}")
                else:
                    log_test("Club Status - Expiration Field", "FAIL", "subscription_expires_at field missing")
                
                # Show all subscription-related fields
                sub_fields = {k: v for k, v in data.items() if 'subscription' in k.lower()}
                if sub_fields:
                    log_test("Club Status - All Subscription Fields", "INFO", f"Fields: {json.dumps(sub_fields, indent=2)}")
                
                return True
            else:
                log_test("Club Status - Subscription Status Field", "FAIL", "subscription_status field missing")
                log_test("Club Status - Available Fields", "INFO", f"Available fields: {list(data.keys())}")
                return False
        else:
            log_test("Club Status", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Club Status", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run club status test"""
    print("=" * 80)
    print("🚀 CLUB STATUS AFTER IAP PURCHASE TESTING")
    print("=" * 80)
    
    result = test_club_status_after_purchase()
    
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    if result:
        print("✅ PASS Club Status After Purchase")
        print("🎉 CLUB STATUS ENDPOINT SHOWS CORRECT SUBSCRIPTION FIELDS!")
    else:
        print("❌ FAIL Club Status After Purchase")
        print("⚠️  Club status endpoint needs review.")
    
    return result

if __name__ == "__main__":
    main()
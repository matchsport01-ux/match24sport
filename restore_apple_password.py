#!/usr/bin/env python3
"""
Apple Reviewer Password Reset - Restore original password
"""

import requests
import json

BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

def make_request(method: str, endpoint: str, data: dict = None, token: str = None, expected_status: int = 200):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
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

def restore_apple_reviewer_password():
    """Restore Apple reviewer password to original"""
    print("🔄 Restoring Apple Reviewer Password to Original")
    print("-" * 50)
    
    # Step 1: Request password reset
    data = {"email": "reviewer@apple.com"}
    response = make_request("POST", "/auth/forgot-password", data)
    
    if response and "reset_token" in response:
        reset_token = response["reset_token"]
        print(f"✅ Reset token received: {reset_token[:20]}...")
        
        # Step 2: Reset password back to original
        reset_data = {
            "token": reset_token,
            "new_password": "AppleReview2024!"
        }
        
        reset_response = make_request("POST", "/auth/reset-password", reset_data)
        if reset_response and "message" in reset_response:
            print(f"✅ Password restored: {reset_response['message']}")
            
            # Step 3: Verify login works
            login_data = {
                "email": "reviewer@apple.com",
                "password": "AppleReview2024!"
            }
            
            login_response = make_request("POST", "/auth/login", login_data)
            if login_response and "access_token" in login_response:
                print(f"✅ Login verified for {login_response['user']['name']} with role: {login_response['user']['role']}")
                return True
            else:
                print("❌ Login verification failed")
                return False
        else:
            print("❌ Password reset failed")
            return False
    else:
        print("❌ Failed to get reset token")
        return False

if __name__ == "__main__":
    restore_apple_reviewer_password()
#!/usr/bin/env python3
"""
Additional Club Reviews Testing - Edge Cases and Sorting
"""

import requests
import json
import uuid
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}: {status}")
    if details:
        print(f"    {details}")

def test_sorting_options():
    """Test different sorting options for reviews"""
    print("\n🎯 TESTING REVIEW SORTING OPTIONS")
    
    # Get a club with reviews
    club_id = "club_16d065e1246d"  # From previous test
    
    # Test different sort options
    sort_options = ["recent", "oldest", "highest", "lowest"]
    
    for sort_option in sort_options:
        try:
            response = requests.get(f"{BASE_URL}/clubs/{club_id}/reviews?sort={sort_option}")
            
            if response.status_code == 200:
                data = response.json()
                reviews = data.get("reviews", [])
                log_test(f"Sort by {sort_option}", "PASS", f"Found {len(reviews)} reviews")
            else:
                log_test(f"Sort by {sort_option}", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test(f"Sort by {sort_option}", "FAIL", f"Exception: {str(e)}")

def test_invalid_review_operations():
    """Test invalid operations to ensure proper error handling"""
    print("\n🎯 TESTING INVALID OPERATIONS")
    
    # Test with invalid review ID
    invalid_review_id = "rev_invalid123"
    
    try:
        # Try to update non-existent review
        response = requests.patch(
            f"{BASE_URL}/reviews/{invalid_review_id}",
            json={"rating": 5},
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        if response.status_code in [401, 404]:
            log_test("Invalid Review Update", "PASS", f"Correctly rejected with status {response.status_code}")
        else:
            log_test("Invalid Review Update", "FAIL", f"Unexpected status: {response.status_code}")
            
    except Exception as e:
        log_test("Invalid Review Update", "FAIL", f"Exception: {str(e)}")

def test_review_validation():
    """Test review validation (rating bounds, comment length)"""
    print("\n🎯 TESTING REVIEW VALIDATION")
    
    # Use existing user credentials
    user_creds = {"email": "reviewer@apple.com", "password": "AppleReview2024!"}
    
    try:
        # Login
        login_response = requests.post(f"{BASE_URL}/auth/login", json=user_creds)
        if login_response.status_code != 200:
            log_test("Review Validation Login", "FAIL", "Could not login")
            return
            
        token = login_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        club_id = "club_16d065e1246d"
        
        # Test invalid rating (out of bounds)
        invalid_rating_data = {"rating": 6, "comment": "Test"}
        response = requests.post(f"{BASE_URL}/clubs/{club_id}/reviews", json=invalid_rating_data, headers=headers)
        
        if response.status_code == 422:  # Validation error
            log_test("Invalid Rating Validation", "PASS", "Rating validation working")
        else:
            log_test("Invalid Rating Validation", "FAIL", f"Status: {response.status_code}")
            
        # Test very long comment (over 500 chars)
        long_comment = "A" * 501
        long_comment_data = {"rating": 4, "comment": long_comment}
        response = requests.post(f"{BASE_URL}/clubs/{club_id}/reviews", json=long_comment_data, headers=headers)
        
        if response.status_code in [400, 422]:  # Validation error
            log_test("Long Comment Validation", "PASS", "Comment length validation working")
        else:
            log_test("Long Comment Validation", "FAIL", f"Status: {response.status_code}")
            
    except Exception as e:
        log_test("Review Validation", "FAIL", f"Exception: {str(e)}")

def main():
    """Run additional Club Reviews tests"""
    print("=" * 80)
    print("🚀 ADDITIONAL CLUB REVIEWS TESTING STARTED")
    print("=" * 80)
    
    # Test sorting options
    test_sorting_options()
    
    # Test invalid operations
    test_invalid_review_operations()
    
    # Test validation
    test_review_validation()
    
    print("\n" + "=" * 80)
    print("📊 ADDITIONAL TESTING COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    main()
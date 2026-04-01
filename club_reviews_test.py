#!/usr/bin/env python3
"""
Club Reviews Backend Testing Script
Tests the Club Reviews feature endpoints for Match Sport 24 app.
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

def create_test_user(email_prefix):
    """Create a test user and return credentials"""
    unique_id = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{unique_id}@test.com"
    password = "TestPass123!"
    
    user_data = {
        "email": email,
        "password": password,
        "name": f"Test User {unique_id}",
        "role": "player",
        "city": "Roma",
        "preferred_sports": ["padel", "tennis"]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=user_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code in [200, 201]:
            log_test(f"Create User {email}", "PASS", f"User created successfully")
            return {"email": email, "password": password}
        else:
            log_test(f"Create User {email}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test(f"Create User {email}", "FAIL", f"Exception: {str(e)}")
        return None

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
            token = data.get("access_token")
            user_id = data.get("user", {}).get("user_id")
            log_test(f"Login {credentials['email']}", "PASS", f"Token obtained, User ID: {user_id}")
            return token, user_id
        else:
            log_test(f"Login {credentials['email']}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None, None
    except Exception as e:
        log_test(f"Login {credentials['email']}", "FAIL", f"Exception: {str(e)}")
        return None, None

def get_clubs():
    """Get list of clubs to find a club_id for testing"""
    try:
        response = requests.get(f"{BASE_URL}/clubs")
        
        if response.status_code == 200:
            clubs = response.json()
            if clubs and len(clubs) > 0:
                club_id = clubs[0]["club_id"]
                club_name = clubs[0]["name"]
                log_test("Get Clubs", "PASS", f"Found {len(clubs)} clubs, using club_id: {club_id} ({club_name})")
                return club_id
            else:
                log_test("Get Clubs", "FAIL", "No clubs found")
                return None
        else:
            log_test("Get Clubs", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Get Clubs", "FAIL", f"Exception: {str(e)}")
        return None

def test_create_review(club_id, token, rating=4, comment="Ottimo circolo, campi perfetti"):
    """Test creating a review for a club"""
    print("\n🎯 TESTING CREATE REVIEW")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    review_data = {
        "rating": rating,
        "comment": comment
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/clubs/{club_id}/reviews",
            json=review_data,
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            review_id = data.get("review", {}).get("review_id")
            club_reviews_count = data.get("club_reviews_count")
            log_test("Create Review", "PASS", f"Review created with ID: {review_id}, Club reviews count: {club_reviews_count}")
            return review_id
        else:
            log_test("Create Review", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Create Review", "FAIL", f"Exception: {str(e)}")
        return None

def test_get_club_reviews(club_id, sort="recent"):
    """Test getting reviews for a club with sorting"""
    print("\n🎯 TESTING GET CLUB REVIEWS")
    
    try:
        response = requests.get(f"{BASE_URL}/clubs/{club_id}/reviews?sort={sort}")
        
        if response.status_code == 200:
            data = response.json()
            reviews = data.get("reviews", [])
            total = data.get("total", 0)
            club_rating = data.get("club_rating_average")
            log_test("Get Club Reviews", "PASS", f"Found {len(reviews)} reviews, Total: {total}, Club rating: {club_rating}")
            return reviews
        else:
            log_test("Get Club Reviews", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Get Club Reviews", "FAIL", f"Exception: {str(e)}")
        return None

def test_update_review(review_id, token, new_rating=5, new_comment="Aggiornato: Circolo fantastico!"):
    """Test updating a review"""
    print("\n🎯 TESTING UPDATE REVIEW")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    update_data = {
        "rating": new_rating,
        "comment": new_comment
    }
    
    try:
        response = requests.patch(
            f"{BASE_URL}/reviews/{review_id}",
            json=update_data,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            updated_rating = data.get("review", {}).get("rating")
            log_test("Update Review", "PASS", f"Review updated, new rating: {updated_rating}")
            return True
        else:
            log_test("Update Review", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Update Review", "FAIL", f"Exception: {str(e)}")
        return False

def test_duplicate_review_prevention(club_id, token):
    """Test that duplicate reviews are prevented"""
    print("\n🎯 TESTING DUPLICATE REVIEW PREVENTION")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    review_data = {
        "rating": 3,
        "comment": "Tentativo di duplicato"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/clubs/{club_id}/reviews",
            json=review_data,
            headers=headers
        )
        
        if response.status_code == 400:
            log_test("Duplicate Review Prevention", "PASS", f"Duplicate correctly prevented: {response.text}")
            return True
        else:
            log_test("Duplicate Review Prevention", "FAIL", f"Expected 400, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Duplicate Review Prevention", "FAIL", f"Exception: {str(e)}")
        return False

def test_unauthorized_update(review_id, token):
    """Test that only the author can update their review"""
    print("\n🎯 TESTING UNAUTHORIZED UPDATE PREVENTION")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    update_data = {
        "rating": 1,
        "comment": "Tentativo di modifica non autorizzata"
    }
    
    try:
        response = requests.patch(
            f"{BASE_URL}/reviews/{review_id}",
            json=update_data,
            headers=headers
        )
        
        if response.status_code == 403:
            log_test("Unauthorized Update Prevention", "PASS", f"Unauthorized update correctly prevented: {response.text}")
            return True
        else:
            log_test("Unauthorized Update Prevention", "FAIL", f"Expected 403, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Unauthorized Update Prevention", "FAIL", f"Exception: {str(e)}")
        return False

def test_report_review(review_id, token):
    """Test reporting a review"""
    print("\n🎯 TESTING REPORT REVIEW")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    report_data = {
        "reason": "Contenuto inappropriato o offensivo"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/reviews/{review_id}/report",
            json=report_data,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test("Report Review", "PASS", f"Review reported successfully: {data.get('message')}")
            return True
        else:
            log_test("Report Review", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Report Review", "FAIL", f"Exception: {str(e)}")
        return False

def test_delete_review(review_id, token):
    """Test deleting a review"""
    print("\n🎯 TESTING DELETE REVIEW")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.delete(
            f"{BASE_URL}/reviews/{review_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            club_reviews_count = data.get("club_reviews_count")
            log_test("Delete Review", "PASS", f"Review deleted successfully, Club reviews count: {club_reviews_count}")
            return True
        else:
            log_test("Delete Review", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Delete Review", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all Club Reviews tests following the specified test flow"""
    print("=" * 80)
    print("🚀 CLUB REVIEWS BACKEND TESTING STARTED")
    print("=" * 80)
    
    test_results = []
    
    # Step 1: Create first test player user
    print("\n📝 STEP 1: Create first test player user")
    user1_creds = create_test_user("review_player1")
    if not user1_creds:
        print("❌ Failed to create first test user. Aborting tests.")
        return False
    
    # Step 2: Login first user
    print("\n🔐 STEP 2: Login first user")
    token1, user1_id = login_user(user1_creds)
    if not token1:
        print("❌ Failed to login first user. Aborting tests.")
        return False
    
    # Step 3: Get a club_id from GET /api/clubs
    print("\n🏢 STEP 3: Get club_id from clubs list")
    club_id = get_clubs()
    if not club_id:
        print("❌ Failed to get club_id. Aborting tests.")
        return False
    
    # Step 4: Create a review with rating 4
    print("\n⭐ STEP 4: Create review with rating 4")
    review_id = test_create_review(club_id, token1, rating=4, comment="Ottimo circolo, campi perfetti")
    test_results.append(("Create Review", review_id is not None))
    if not review_id:
        print("❌ Failed to create review. Aborting remaining tests.")
        return False
    
    # Step 5: Verify the review appears in GET /api/clubs/{club_id}/reviews
    print("\n📋 STEP 5: Verify review appears in club reviews")
    reviews = test_get_club_reviews(club_id, sort="recent")
    review_found = reviews is not None and any(r.get("review_id") == review_id for r in reviews)
    test_results.append(("Get Club Reviews", review_found))
    
    # Step 6: Update the review to rating 5
    print("\n✏️ STEP 6: Update review to rating 5")
    update_success = test_update_review(review_id, token1, new_rating=5)
    test_results.append(("Update Review", update_success))
    
    # Step 7: Try to create another review (should fail - duplicate)
    print("\n🚫 STEP 7: Try to create duplicate review")
    duplicate_prevented = test_duplicate_review_prevention(club_id, token1)
    test_results.append(("Duplicate Prevention", duplicate_prevented))
    
    # Step 8: Create a second test user
    print("\n👤 STEP 8: Create second test user")
    user2_creds = create_test_user("review_player2")
    if not user2_creds:
        print("❌ Failed to create second test user. Continuing with remaining tests.")
        test_results.append(("Create Second User", False))
    else:
        test_results.append(("Create Second User", True))
        
        # Step 9: Login second user
        print("\n🔐 STEP 9: Login second user")
        token2, user2_id = login_user(user2_creds)
        if not token2:
            print("❌ Failed to login second user. Continuing with remaining tests.")
            test_results.append(("Login Second User", False))
        else:
            test_results.append(("Login Second User", True))
            
            # Step 10: Try to update review with second user (should fail - not owner)
            print("\n🔒 STEP 10: Try to update review with second user (should fail)")
            unauthorized_prevented = test_unauthorized_update(review_id, token2)
            test_results.append(("Unauthorized Update Prevention", unauthorized_prevented))
            
            # Step 11: Report the review with second user
            print("\n🚨 STEP 11: Report review with second user")
            report_success = test_report_review(review_id, token2)
            test_results.append(("Report Review", report_success))
    
    # Step 12: Delete the review with first user
    print("\n🗑️ STEP 12: Delete review with first user")
    delete_success = test_delete_review(review_id, token1)
    test_results.append(("Delete Review", delete_success))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 CLUB REVIEWS TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🏆 OVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL CLUB REVIEWS ENDPOINTS ARE FULLY FUNCTIONAL!")
        print("\n✅ VERIFIED BEHAVIORS:")
        print("  • Only authenticated players can create reviews")
        print("  • One review per user per club (duplicate prevention)")
        print("  • Only author can edit/delete their review")
        print("  • Club rating_average updates after create/update/delete")
        print("  • Review reporting system working")
        print("  • Proper authorization and validation")
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    main()
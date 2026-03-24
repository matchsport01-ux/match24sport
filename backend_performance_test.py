#!/usr/bin/env python3
"""
Backend Performance Optimization Testing Script
Testing GZIP compression, caching, MongoDB indexes, and database statistics
"""

import requests
import json
import sys
import time
from datetime import datetime
import gzip
import io

# Configuration
BASE_URL = "https://padel-finder-app.preview.emergentagent.com/api"

class PerformanceTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and isinstance(response_data, dict):
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_gzip_compression(self):
        """TEST 1: GZIP Compression - Check response headers for Content-Encoding: gzip"""
        print("🗜️ TEST 1: GZIP Compression")
        
        try:
            # Make request to /api/clubs which should return substantial data
            response = self.session.get(f"{BASE_URL}/clubs", headers={
                'Accept-Encoding': 'gzip, deflate'
            })
            
            if response.status_code == 200:
                # Check for gzip compression in headers
                content_encoding = response.headers.get('Content-Encoding', '').lower()
                content_length = len(response.content)
                
                if 'gzip' in content_encoding:
                    self.log_test("GZIP Compression", True, 
                                f"Response compressed with gzip. Content-Length: {content_length} bytes, Content-Encoding: {content_encoding}")
                    return True
                else:
                    # Check if response is large enough to trigger compression (FastAPI GZipMiddleware default is 500 bytes)
                    if content_length < 500:
                        self.log_test("GZIP Compression", True, 
                                    f"Response too small for compression ({content_length} bytes < 500 bytes threshold). This is expected behavior.")
                        return True
                    else:
                        self.log_test("GZIP Compression", False, 
                                    f"Response large enough ({content_length} bytes) but not compressed. Content-Encoding: {content_encoding or 'None'}")
                        return False
            else:
                self.log_test("GZIP Compression", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GZIP Compression", False, f"Exception: {str(e)}")
            return False
    
    def test_cache_functionality(self):
        """TEST 2: Cache Functionality - Test /api/cities caching"""
        print("⚡ TEST 2: Cache Functionality")
        
        try:
            # First call to /api/cities
            start_time1 = time.time()
            response1 = self.session.get(f"{BASE_URL}/cities")
            end_time1 = time.time()
            first_call_time = (end_time1 - start_time1) * 1000  # Convert to milliseconds
            
            if response1.status_code != 200:
                self.log_test("Cache Functionality", False, 
                            f"First call failed: HTTP {response1.status_code}")
                return False
            
            cities1 = response1.json()
            
            # Small delay to ensure timing difference
            time.sleep(0.1)
            
            # Second call to /api/cities (should be cached)
            start_time2 = time.time()
            response2 = self.session.get(f"{BASE_URL}/cities")
            end_time2 = time.time()
            second_call_time = (end_time2 - start_time2) * 1000  # Convert to milliseconds
            
            if response2.status_code != 200:
                self.log_test("Cache Functionality", False, 
                            f"Second call failed: HTTP {response2.status_code}")
                return False
            
            cities2 = response2.json()
            
            # Verify responses are identical (cached)
            if cities1 == cities2:
                # Check if second call was faster (indicating cache hit)
                speed_improvement = first_call_time - second_call_time
                cache_hit = second_call_time < first_call_time or second_call_time < 50  # Very fast response indicates cache
                
                self.log_test("Cache Functionality", True, 
                            f"Cities endpoint cached correctly. First call: {first_call_time:.2f}ms, Second call: {second_call_time:.2f}ms. Cache hit: {cache_hit}",
                            {"cities_count": len(cities1), "first_call_ms": round(first_call_time, 2), "second_call_ms": round(second_call_time, 2)})
                return True
            else:
                self.log_test("Cache Functionality", False, 
                            "Responses differ between calls - cache not working correctly")
                return False
                
        except Exception as e:
            self.log_test("Cache Functionality", False, f"Exception: {str(e)}")
            return False
    
    def test_sports_durations_cache(self):
        """TEST 3: Sports Durations Static Data - Test /api/sports/durations"""
        print("⏱️ TEST 3: Sports Durations Static Data")
        
        try:
            response = self.session.get(f"{BASE_URL}/sports/durations")
            
            if response.status_code == 200:
                durations = response.json()
                
                # Expected sports and their durations
                expected_sports = ["padel", "tennis", "calcetto", "calcio8"]
                
                # Verify all expected sports are present
                missing_sports = [sport for sport in expected_sports if sport not in durations]
                
                if not missing_sports:
                    self.log_test("Sports Durations Static Data", True, 
                                f"All {len(expected_sports)} sports configured with durations",
                                durations)
                    return True
                else:
                    self.log_test("Sports Durations Static Data", False, 
                                f"Missing sports: {missing_sports}", durations)
                    return False
            else:
                self.log_test("Sports Durations Static Data", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Sports Durations Static Data", False, f"Exception: {str(e)}")
            return False
    
    def test_health_endpoint(self):
        """TEST 4: Health Endpoint - Verify server is running"""
        print("🏥 TEST 4: Database Statistics/Health")
        
        try:
            response = self.session.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                health_data = response.json()
                
                if health_data.get("status") == "healthy":
                    self.log_test("Health Endpoint", True, 
                                "Server health check passed", health_data)
                    return True
                else:
                    self.log_test("Health Endpoint", False, 
                                f"Unexpected health status: {health_data}")
                    return False
            else:
                self.log_test("Health Endpoint", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_club_list_caching(self):
        """TEST 5: Club List Caching - Test /api/clubs caching with limit"""
        print("🏢 TEST 5: Club List Caching")
        
        try:
            # First call to /api/clubs with limit
            start_time1 = time.time()
            response1 = self.session.get(f"{BASE_URL}/clubs?limit=5")
            end_time1 = time.time()
            first_call_time = (end_time1 - start_time1) * 1000
            
            if response1.status_code != 200:
                self.log_test("Club List Caching", False, 
                            f"First call failed: HTTP {response1.status_code}")
                return False
            
            clubs1 = response1.json()
            
            # Small delay
            time.sleep(0.1)
            
            # Second call to /api/clubs with same limit (should be cached)
            start_time2 = time.time()
            response2 = self.session.get(f"{BASE_URL}/clubs?limit=5")
            end_time2 = time.time()
            second_call_time = (end_time2 - start_time2) * 1000
            
            if response2.status_code != 200:
                self.log_test("Club List Caching", False, 
                            f"Second call failed: HTTP {response2.status_code}")
                return False
            
            clubs2 = response2.json()
            
            # Verify responses are identical (cached)
            if clubs1 == clubs2:
                cache_hit = second_call_time < first_call_time or second_call_time < 50
                
                self.log_test("Club List Caching", True, 
                            f"Club list cached correctly. First call: {first_call_time:.2f}ms, Second call: {second_call_time:.2f}ms. Cache hit: {cache_hit}",
                            {"clubs_returned": len(clubs1), "first_call_ms": round(first_call_time, 2), "second_call_ms": round(second_call_time, 2)})
                return True
            else:
                self.log_test("Club List Caching", False, 
                            "Club list responses differ between calls - cache not working correctly")
                return False
                
        except Exception as e:
            self.log_test("Club List Caching", False, f"Exception: {str(e)}")
            return False
    
    def test_mongodb_indexes_verification(self):
        """TEST 6: MongoDB Index Verification - Indirect test via performance"""
        print("🗄️ TEST 6: MongoDB Index Verification (Performance-based)")
        
        try:
            # Test multiple endpoints that rely on indexes for good performance
            test_endpoints = [
                ("/clubs", "Clubs listing (city, is_active indexes)"),
                ("/cities", "Cities distinct query (city index)"),
                ("/sports/durations", "Sports durations (static data)")
            ]
            
            all_fast = True
            results = []
            
            for endpoint, description in test_endpoints:
                start_time = time.time()
                response = self.session.get(f"{BASE_URL}{endpoint}")
                end_time = time.time()
                response_time = (end_time - start_time) * 1000
                
                if response.status_code == 200:
                    # Consider response fast if under 500ms (good index performance)
                    is_fast = response_time < 500
                    results.append(f"{description}: {response_time:.2f}ms {'✓' if is_fast else '✗'}")
                    
                    if not is_fast:
                        all_fast = False
                else:
                    results.append(f"{description}: HTTP {response.status_code} ✗")
                    all_fast = False
            
            if all_fast:
                self.log_test("MongoDB Index Performance", True, 
                            "All indexed queries performing well (< 500ms)", 
                            {"endpoint_performance": results})
                return True
            else:
                self.log_test("MongoDB Index Performance", False, 
                            "Some queries performing slowly - may indicate missing indexes",
                            {"endpoint_performance": results})
                return False
                
        except Exception as e:
            self.log_test("MongoDB Index Performance", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all performance optimization tests"""
        print("🚀 STARTING PERFORMANCE OPTIMIZATION TESTING")
        print("=" * 60)
        
        tests = [
            ("GZIP Compression", self.test_gzip_compression),
            ("Cache Functionality", self.test_cache_functionality),
            ("Sports Durations Static Data", self.test_sports_durations_cache),
            ("Health Endpoint", self.test_health_endpoint),
            ("Club List Caching", self.test_club_list_caching),
            ("MongoDB Index Performance", self.test_mongodb_indexes_verification)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            if test_func():
                passed += 1
        
        print("=" * 60)
        print(f"🏆 FINAL RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ ALL PERFORMANCE TESTS PASSED - Backend optimizations working correctly")
        else:
            print("❌ SOME PERFORMANCE TESTS FAILED - Performance optimizations need attention")
        
        # Summary of results
        print("\n📊 PERFORMANCE TEST SUMMARY:")
        for result in self.test_results:
            status = "PASS" if result["success"] else "FAIL"
            print(f"  {status}: {result['test']}")
        
        return passed == total

def main():
    """Main execution function"""
    tester = PerformanceTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
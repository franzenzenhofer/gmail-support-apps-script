#!/usr/bin/env python3
"""
URL Testing Script for Gmail Support System
Tests all URLs found in the project to ensure they are valid
"""

import os
import re
import requests
import json
from urllib.parse import urlparse
from pathlib import Path
import sys

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def extract_urls_from_file(filepath):
    """Extract all URLs from a file"""
    urls = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Regex to find URLs
        url_pattern = re.compile(r'https?://[^\s\'"<>{}|\\^`\[\]]+')
        found_urls = url_pattern.findall(content)
        
        # Clean up URLs (remove trailing punctuation)
        for url in found_urls:
            clean_url = url.rstrip('.,;:!?)')
            urls.append((clean_url, filepath))
            
    except Exception as e:
        print(f"{RED}Error reading {filepath}: {e}{RESET}")
    
    return urls

def test_url(url):
    """Test if a URL is valid and accessible"""
    try:
        # Parse URL
        parsed = urlparse(url)
        
        # Skip localhost and example domains
        if parsed.hostname in ['localhost', 'example.com', '127.0.0.1']:
            return 'skip', 'Local/example URL'
        
        # Special handling for certain domains
        if 'github.com' in url and '/repos/' in url and '/api.github.com' not in url:
            # Convert GitHub URLs to API format
            url = url.replace('github.com', 'api.github.com/repos')
        
        # Test the URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; URLTester/1.0)'
        }
        
        response = requests.head(url, headers=headers, timeout=10, allow_redirects=True)
        
        if response.status_code < 400:
            return 'success', f'Status: {response.status_code}'
        else:
            return 'fail', f'Status: {response.status_code}'
            
    except requests.exceptions.Timeout:
        return 'fail', 'Timeout'
    except requests.exceptions.ConnectionError:
        return 'fail', 'Connection error'
    except Exception as e:
        return 'fail', str(e)

def main():
    """Main function to test all URLs in the project"""
    print(f"{YELLOW}=== Gmail Support System URL Tester ==={RESET}\n")
    
    # Get all files to check
    project_root = Path('.')
    files_to_check = []
    
    # Add all .gs files
    files_to_check.extend(project_root.glob('*.gs'))
    
    # Add all .md files
    files_to_check.extend(project_root.glob('*.md'))
    
    # Add all .html files
    files_to_check.extend(project_root.glob('*.html'))
    
    # Extract all URLs
    all_urls = []
    for filepath in files_to_check:
        urls = extract_urls_from_file(filepath)
        all_urls.extend(urls)
    
    # Remove duplicates while preserving file info
    unique_urls = {}
    for url, filepath in all_urls:
        if url not in unique_urls:
            unique_urls[url] = []
        unique_urls[url].append(filepath)
    
    print(f"Found {len(unique_urls)} unique URLs in {len(files_to_check)} files\n")
    
    # Test each URL
    results = {
        'success': [],
        'fail': [],
        'skip': []
    }
    
    for i, (url, files) in enumerate(unique_urls.items(), 1):
        print(f"[{i}/{len(unique_urls)}] Testing: {url}")
        status, message = test_url(url)
        
        result = {
            'url': url,
            'files': [str(f) for f in files],
            'status': status,
            'message': message
        }
        
        results[status].append(result)
        
        if status == 'success':
            print(f"{GREEN}✓ {message}{RESET}")
        elif status == 'skip':
            print(f"{YELLOW}⚠ {message}{RESET}")
        else:
            print(f"{RED}✗ {message}{RESET}")
    
    # Summary
    print(f"\n{YELLOW}=== Summary ==={RESET}")
    print(f"{GREEN}Successful: {len(results['success'])}{RESET}")
    print(f"{YELLOW}Skipped: {len(results['skip'])}{RESET}")
    print(f"{RED}Failed: {len(results['fail'])}{RESET}")
    
    # Write detailed results
    with open('url_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print failed URLs with their locations
    if results['fail']:
        print(f"\n{RED}=== Failed URLs ==={RESET}")
        for item in results['fail']:
            print(f"\nURL: {item['url']}")
            print(f"Error: {item['message']}")
            print(f"Found in:")
            for file in item['files']:
                print(f"  - {file}")
    
    # Return exit code based on failures
    sys.exit(len(results['fail']))

if __name__ == '__main__':
    main()
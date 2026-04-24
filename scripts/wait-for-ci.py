#!/usr/bin/env python3
"""
Wait for required CI checks to pass before continuing.
Used by Railway preview deployment workflow.
"""
import os
import sys
import time

import requests

GITHUB_API = "https://api.github.com"
REQUIRED_CHECKS = [
    "Lint & Type Check",
    "Server Tests", 
    "Client Tests",
    "Build Check"
]

def main():
    token = os.environ.get("GITHUB_TOKEN")
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER")
    repo = os.environ.get("GITHUB_REPOSITORY_NAME") or os.environ.get("GITHUB_REPOSITORY", "").split("/")[-1]
    sha = os.environ.get("GITHUB_SHA")
    
    if not all([token, owner, repo, sha]):
        print("Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY, GITHUB_SHA")
        sys.exit(1)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json"
    }
    
    url = f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}/check-runs"
    
    print(f"Checking required checks for {owner}/{repo}@{sha[:7]}")
    print(f"Required: {', '.join(REQUIRED_CHECKS)}")
    
    max_retries = 30
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        checks = {run["name"]: run for run in data.get("check_runs", [])}
        
        pending = []
        missing = []
        
        for name in REQUIRED_CHECKS:
            check = checks.get(name)
            if not check:
                missing.append(name)
            elif check["status"] != "completed":
                pending.append(f"{name} ({check['status']})")
            elif check["conclusion"] != "success":
                pending.append(f"{name} ({check['conclusion']})")
        
        if not pending and not missing:
            print("✅ All required checks passed!")
            return
        
        if attempt < max_retries - 1:
            if missing:
                print(f"  Waiting for: {', '.join(missing)} (not started)")
            if pending:
                print(f"  In progress: {', '.join(pending)}")
            print(f"  Retry {attempt + 1}/{max_retries} in 10s...")
            time.sleep(10)
        else:
            print(f"❌ Timeout waiting for checks")
            print(f"  Still missing or failed: {', '.join(pending + missing)}")
            sys.exit(1)

if __name__ == "__main__":
    main()

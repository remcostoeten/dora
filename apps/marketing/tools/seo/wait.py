#!/usr/bin/env python3

import sys
import time

import requests


def wait_url(url):
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code < 500:
                return 0
        except requests.RequestException:
            pass
        time.sleep(2)
    print(f"Timed out waiting for {url}")
    return 1


if __name__ == "__main__":
    sys.exit(wait_url(sys.argv[1]))

#!/usr/bin/env python3

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[1]
CONFIG = ROOT / "config.json"
CHROME_CACHE = PROJECT_ROOT / ".cache" / "chrome"
CHROME_COMMANDS = (
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "chrome",
)


def load_config():
    with CONFIG.open("r", encoding="utf-8") as file:
        return json.load(file)


def clean_url(value):
    if not value.startswith(("http://", "https://")):
        if value.startswith(("localhost", "127.0.0.1", "0.0.0.0")):
            return f"http://{value}"
        return f"https://{value}"
    return value.rstrip("/")


def fetch_url(url):
    try:
        response = requests.get(url, timeout=20)
        return response, None
    except requests.RequestException as error:
        return None, str(error)


def pass_row(name, value, status, detail):
    return {
        "check": name,
        "value": value,
        "status": "PASS" if status else "FAIL",
        "detail": detail,
    }


def robots_check(base):
    url = urljoin(base + "/", "robots.txt")
    response, error = fetch_url(url)
    if error:
        return pass_row("robots.txt", "missing", False, error)
    text = response.text.strip() if response else ""
    has_user_agent = bool(re.search(r"(?im)^user-agent\s*:", text))
    ok = response.status_code == 200 and len(text) > 0 and has_user_agent
    detail = "found" if ok else f"status {response.status_code}"
    return pass_row("robots.txt", response.status_code, ok, detail)


def sitemap_check(base):
    url = urljoin(base + "/", "sitemap.xml")
    response, error = fetch_url(url)
    if error:
        return pass_row("sitemap.xml", "missing", False, error)
    if response.status_code != 200:
        return pass_row("sitemap.xml", response.status_code, False, f"status {response.status_code}")
    try:
        root = ElementTree.fromstring(response.content)
        valid = root.tag.endswith(("urlset", "sitemapindex"))
        count = len(list(root))
        ok = valid and count > 0
        detail = f"{count} entries" if ok else "invalid sitemap structure"
        return pass_row("sitemap.xml", count, ok, detail)
    except ElementTree.ParseError as error:
        return pass_row("sitemap.xml", "invalid", False, str(error))


def html_check(base, limit):
    response, error = fetch_url(base)
    rows = []
    if error:
        return [pass_row("html", "unreachable", False, error)], None
    html = response.text
    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("title")
    description = soup.find("meta", attrs={"name": "description"})
    canonical = soup.find("link", attrs={"rel": "canonical"})
    h1s = soup.find_all("h1")
    size = round(len(response.content) / 1024, 2)
    rows.append(pass_row("title", text_value(title), bool(text_value(title)), "present" if text_value(title) else "missing"))
    rows.append(pass_row("description", meta_value(description), bool(meta_value(description)), "present" if meta_value(description) else "missing"))
    rows.append(pass_row("canonical", link_value(canonical), bool(link_value(canonical)), "present" if link_value(canonical) else "missing"))
    rows.append(pass_row("h1", len(h1s), len(h1s) == 1, "exactly 1 required"))
    rows.append(pass_row("page size", f"{size} KB", size <= limit, f"<= {limit} KB"))
    return rows, response


def text_value(tag):
    return tag.get_text(strip=True) if tag else ""


def meta_value(tag):
    return tag.get("content", "").strip() if tag else ""


def link_value(tag):
    return tag.get("href", "").strip() if tag else ""


def executable(path):
    return path and Path(path).is_file() and os.access(path, os.X_OK)


def system_chrome_path():
    for command in CHROME_COMMANDS:
        path = shutil.which(command)
        if executable(path):
            return path
    return None


def cached_chrome_path():
    matches = sorted(CHROME_CACHE.glob("chrome/*/chrome-*/chrome"))
    for path in reversed(matches):
        if executable(path):
            return str(path)
    return None


def install_chrome():
    CHROME_CACHE.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "bunx",
            "@puppeteer/browsers",
            "install",
            "chrome@stable",
            "--path",
            str(CHROME_CACHE),
            "--format",
            "{{path}}",
        ],
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        output = result.stderr.strip() or result.stdout.strip()
        return None, output or "failed to install Chrome"
    for line in reversed(result.stdout.splitlines()):
        path = line.strip()
        if executable(path):
            return path, None
    path = cached_chrome_path()
    if path:
        return path, None
    return None, "Chrome installed, but executable path was not found"


def lighthouse_env():
    env = os.environ.copy()
    if executable(env.get("CHROME_PATH")):
        return env, None
    path = system_chrome_path() or cached_chrome_path()
    if path:
        env["CHROME_PATH"] = path
        return env, None
    path, error = install_chrome()
    if error:
        return None, error
    env["CHROME_PATH"] = path
    return env, None


def light_run(base, config):
    command = config["lighthouse"]["command"]
    extra = config["lighthouse"].get("args", [])
    flags = config["lighthouse"]["chromeFlags"]
    timeout = config["lighthouse"]["timeout"]
    env, chrome_error = lighthouse_env()
    if chrome_error:
        return None, chrome_error
    args = [
        command,
        *extra,
        base,
        "--output=json",
        "--output-path=stdout",
        "--quiet",
        "--only-categories=performance,seo",
        f"--chrome-flags={flags}",
    ]
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False, env=env)
    except FileNotFoundError:
        return None, f"{command} not found"
    except subprocess.TimeoutExpired:
        return None, f"{command} timed out after {timeout}s"
    if result.returncode != 0:
        return None, result.stderr.strip() or result.stdout.strip()
    try:
        return json.loads(result.stdout), None
    except json.JSONDecodeError as error:
        return None, str(error)


def light_rows(data, thresholds):
    if not data:
        return []
    categories = data.get("categories", {})
    audits = data.get("audits", {})
    performance = score_value(categories.get("performance", {}))
    seo = score_value(categories.get("seo", {}))
    lcp = numeric_value(audits.get("largest-contentful-paint", {}))
    cls = numeric_value(audits.get("cumulative-layout-shift", {}))
    return [
        pass_row("performance", performance, performance >= thresholds["performance"], f">= {thresholds['performance']}"),
        pass_row("seo", seo, seo >= thresholds["seo"], f">= {thresholds['seo']}"),
        pass_row("lcp", f"{round(lcp, 2)} ms", lcp <= thresholds["lcp"], f"<= {thresholds['lcp']} ms"),
        pass_row("cls", round(cls, 4), cls <= thresholds["cls"], f"<= {thresholds['cls']}"),
    ]


def score_value(category):
    return round(float(category.get("score", 0)) * 100)


def numeric_value(audit):
    value = audit.get("numericValue")
    return float(value) if value is not None else float("inf")


def draw_table(rows):
    headers = ["Check", "Value", "Status", "Detail"]
    data = [[row["check"], str(row["value"]), row["status"], row["detail"]] for row in rows]
    widths = [len(header) for header in headers]
    for row in data:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))
    line = "+".join("-" * (width + 2) for width in widths)
    print(line.join(["+", "+"]))
    print("| " + " | ".join(headers[index].ljust(widths[index]) for index in range(len(headers))) + " |")
    print(line.join(["+", "+"]))
    for row in data:
        print("| " + " | ".join(row[index].ljust(widths[index]) for index in range(len(row))) + " |")
    print(line.join(["+", "+"]))


def save_report(path, report):
    target = Path(path)
    if not target.is_absolute():
        target = Path.cwd() / target
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return target


def audit_run(base, config):
    thresholds = config["thresholds"]
    rows = [robots_check(base), sitemap_check(base)]
    html_rows, _ = html_check(base, thresholds["size"])
    rows.extend(html_rows)
    lighthouse, error = light_run(base, config)
    if error:
        rows.append(pass_row("lighthouse", "error", False, error))
    rows.extend(light_rows(lighthouse, thresholds))
    return rows, lighthouse


def fail_rows(rows):
    return [row for row in rows if row["status"] == "FAIL"]


def main():
    parser = argparse.ArgumentParser(prog="seo-audit")
    parser.add_argument("url", nargs="?", default="http://localhost:3000")
    args = parser.parse_args()
    config = load_config()
    base = clean_url(args.url)
    rows, lighthouse = audit_run(base, config)
    failures = fail_rows(rows)
    report = {
        "url": base,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "passed": len(failures) == 0,
        "checks": rows,
        "lighthouse": lighthouse,
    }
    target = save_report(config["report"], report)
    draw_table(rows)
    print(f"Report: {target}")
    if failures:
        print("Failures:")
        for row in failures:
            print(f"- {row['check']}: {row['detail']}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

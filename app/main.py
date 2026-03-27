"""
Main application entry point for MeshMe.

This FastAPI application serves a small social login prototype with a
beautiful animated landing page.  Users can create an account, log in
using their username or email address, and view a simple dashboard once
authenticated.  Session management is handled via signed cookies using
``itsdangerous``.  Passwords are hashed securely via PassLib.

To run the application locally:

    uvicorn app.main:app --reload

``requirements.txt`` lists all dependencies.  Ensure you have
the necessary packages installed via pip.
"""

from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, Response, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
from urllib.parse import parse_qs

from .config import get_settings
from .auth import (
    create_serializer,
    create_session_token,
    decode_session_token,
    get_password_hash,
    verify_password,
    SESSION_COOKIE_NAME,
)


def create_app() -> FastAPI:
    settings = get_settings()
    serializer = create_serializer(settings.secret_key)
    SESSION_ID_COOKIE_NAME = "meshme_sid"
    CSRF_COOKIE_NAME = "meshme_csrf"

    app = FastAPI(title="mesh.me", version="0.2.0")
    @app.middleware("http")
    async def secure_headers_middleware(request: Request, call_next):
        if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
            token = request.cookies.get(SESSION_COOKIE_NAME)
            sid = request.cookies.get(SESSION_ID_COOKIE_NAME)
            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME, "")
            if token and sid:
                user_id = decode_session_token(serializer, token)
                if user_id is not None:
                    users = load_users()
                    user = find_user_by_id(user_id, users)
                    if user and validate_user_session(user, sid):
                        provided = request.headers.get("x-csrf-token", "")
                        content_type = request.headers.get("content-type", "")
                        if not provided and "application/x-www-form-urlencoded" in content_type:
                            body = await request.body()
                            parsed = parse_qs(body.decode("utf-8"), keep_blank_values=True)
                            provided = (parsed.get("csrf_token") or [""])[0]
                            async def receive():
                                return {"type": "http.request", "body": body, "more_body": False}
                            request._receive = receive
                        if not csrf_cookie or not provided or not secrets.compare_digest(csrf_cookie, provided):
                            return Response(content="CSRF validation failed", status_code=403)
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
        return response
    # Mount static files under /static
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

    # Path to the JSON file that stores users.  Each entry is a dict with
    # ``id``, ``username``, ``email`` and ``hashed_password`` keys, plus
    # optional preferences, messages, notifications and following lists.
    user_file = Path(__file__).resolve().parent / "users.json"

    # Path to the JSON file that stores posts.  Each post record contains an
    # ``id``, ``user_id``, ``title``, ``content``, ``timestamp``, ``likes``
    # (list of user IDs) and ``comments`` (list of comment objects).
    posts_file = Path(__file__).resolve().parent / "posts.json"
    reports_file = Path(__file__).resolve().parent / "reports.json"
    groups_file = Path(__file__).resolve().parent / "groups.json"
    sync_jobs_file = Path(__file__).resolve().parent / "sync_jobs.json"
    audit_log_file = Path(__file__).resolve().parent / "audit_log.json"
    login_attempts: defaultdict[str, deque] = defaultdict(deque)
    message_attempts: defaultdict[int, deque] = defaultdict(deque)
    SESSION_MAX_AGE = timedelta(days=7)
    SESSION_IDLE_TIMEOUT = timedelta(hours=24)

    def write_json_atomic(path: Path, payload) -> None:
        """Write JSON to disk atomically to reduce corruption risk."""
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f)
        tmp_path.replace(path)

    def ensure_user_defaults(u: dict) -> dict:
        """Ensure a loaded user dict has all expected keys for preferences and social data.

        Over time new features have been added to MeshMe.  To preserve backwards
        compatibility with older ``users.json`` records, this helper fills in
        missing fields for preferences, messaging, notifications and following
        information.  If a key already exists it is left untouched.  Without
        these defaults the Jinja templates and route handlers may crash when
        attempting to access missing keys.

        The preferences block controls UI customisation (feed layout), whether
        notifications and summaries are enabled, which external platforms are
        connected and whether read receipts are shown in MeChat.  Messages and
        notifications store internal data for unified messaging and alerts.  The
        ``following`` list tracks the IDs of accounts that a user follows.
        """
        prefs = u.setdefault(
            "preferences",
            {
                "feed_layout": "instagram",
                "notifications_enabled": True,
                "summary_enabled": False,
                "connected_platforms": [],
                "read_receipts": True,
                "native_notifications_muted": False,
                "privacy_mode": "balanced",
                "feed_presets": [],
                "group_ids": [],
                "blocked_user_ids": [],
                "profile_visibility": "public",
                "pinned_threads": [],
            },
        )
        # Ensure each expected preference key exists (future‑proofing)
        prefs.setdefault("feed_layout", "instagram")
        prefs.setdefault("notifications_enabled", True)
        prefs.setdefault("summary_enabled", False)
        prefs.setdefault("connected_platforms", [])
        prefs.setdefault("read_receipts", True)
        prefs.setdefault("native_notifications_muted", False)
        prefs.setdefault("privacy_mode", "balanced")
        prefs.setdefault("feed_presets", [])
        prefs.setdefault("group_ids", [])
        prefs.setdefault("blocked_user_ids", [])
        prefs.setdefault("profile_visibility", "public")
        prefs.setdefault("pinned_threads", [])
        # Messaging: list of message dicts (sender_id, receiver_id, message, platform, timestamp)
        u.setdefault("messages", [])
        # Notifications: list of notification dicts (platform, content, timestamp)
        u.setdefault("notifications", [])
        # Sync events: actions mirrored to native platforms.
        u.setdefault("sync_events", [])
        u.setdefault("privacy_requests", [])
        u.setdefault("typing_state", {})
        # Following: list of user IDs this account follows
        u.setdefault("following", [])
        u.setdefault("sessions", [])
        return u

    def load_users() -> list[dict]:
        """Load the user list from disk, inserting default keys for new features as needed.

        Legacy installations may have been created before new preferences or message fields
        existed.  To maintain backward compatibility, each user record is passed through
        ``ensure_user_defaults`` before being returned."""
        if user_file.exists():
            try:
                with user_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    # ensure defaults for each user
                    return [ensure_user_defaults(u) for u in data]
            except Exception:
                return []
        return []

    def load_posts() -> list[dict]:
        """Load the list of posts from disk.

        Returns an empty list if the posts file does not exist or cannot be
        decoded.  Each post is a dictionary containing the keys described in
        ``posts_file`` above.  If older posts are missing expected keys, this
        function initialises defaults to preserve backwards compatibility."""
        if posts_file.exists():
            try:
                with posts_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    # ensure defaults for each post record
                    for p in data:
                        p.setdefault("likes", [])
                        p.setdefault("comments", [])
                        p.setdefault("source_platform", "mesh")
                        p.setdefault("external_post_id", None)
                        p.setdefault("external_url", "")
                        p.setdefault("tags", [])
                        p.setdefault("group_id", None)
                    return data
            except Exception:
                return []
        return []

    def save_posts(posts: list[dict]) -> None:
        """Persist the list of posts to disk."""
        write_json_atomic(posts_file, posts)

    def save_users(users: list[dict]) -> None:
        write_json_atomic(user_file, users)

    def load_reports() -> list[dict]:
        """Load moderation reports."""
        if reports_file.exists():
            try:
                with reports_file.open("r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def save_reports(reports: list[dict]) -> None:
        """Persist moderation reports."""
        write_json_atomic(reports_file, reports)

    def load_groups() -> list[dict]:
        """Load groups for community features."""
        if groups_file.exists():
            try:
                with groups_file.open("r", encoding="utf-8") as f:
                    groups = json.load(f)
                    for g in groups:
                        g.setdefault("members", [])
                        g.setdefault("tags", [])
                        g.setdefault("description", "")
                    return groups
            except Exception:
                return []
        return []

    def save_groups(groups: list[dict]) -> None:
        """Persist groups."""
        write_json_atomic(groups_file, groups)

    def load_sync_jobs() -> list[dict]:
        """Load integration sync jobs."""
        if sync_jobs_file.exists():
            try:
                with sync_jobs_file.open("r", encoding="utf-8") as f:
                    jobs = json.load(f)
                    for job in jobs:
                        job.setdefault("status", "queued")
                        job.setdefault("attempts", 0)
                    return jobs
            except Exception:
                return []
        return []

    def save_sync_jobs(jobs: list[dict]) -> None:
        """Persist sync jobs."""
        write_json_atomic(sync_jobs_file, jobs)

    def load_audit_log() -> list[dict]:
        """Load security/audit events."""
        if audit_log_file.exists():
            try:
                with audit_log_file.open("r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def save_audit_log(events: list[dict]) -> None:
        """Persist security/audit events."""
        write_json_atomic(audit_log_file, events)

    def log_security_event(actor_id: Optional[int], action: str, detail: str, severity: str = "info") -> None:
        """Append a structured security event."""
        events = load_audit_log()
        events.append(
            {
                "id": max((e.get("id", 0) for e in events), default=0) + 1,
                "actor_id": actor_id,
                "action": action,
                "detail": detail[:240],
                "severity": severity,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        save_audit_log(events[-400:])

    def clean_text(value: str, max_len: int = 500) -> str:
        """Trim and bound free-form input text."""
        return " ".join((value or "").strip().split())[:max_len]

    def is_rate_limited(bucket: deque, max_events: int, window_seconds: int) -> bool:
        """Return True when events in bucket exceed allowed threshold in sliding window."""
        now = datetime.utcnow()
        while bucket and (now - bucket[0]).total_seconds() > window_seconds:
            bucket.popleft()
        if len(bucket) >= max_events:
            return True
        bucket.append(now)
        return False

    def find_user_by_identifier(identifier: str, users: list[dict]) -> Optional[dict]:
        for user in users:
            if user["username"] == identifier or user["email"] == identifier:
                return user
        return None

    def find_user_by_id(user_id: int, users: list[dict]) -> Optional[dict]:
        for user in users:
            if user["id"] == user_id:
                return user
        return None

    def users_are_blocked(user_a_id: int, user_b_id: int, users: list[dict]) -> bool:
        """Return True when either user has blocked the other."""
        if user_a_id == user_b_id:
            return False
        user_a = find_user_by_id(user_a_id, users)
        user_b = find_user_by_id(user_b_id, users)
        if not user_a or not user_b:
            return False
        a_blocked = set(user_a.get("preferences", {}).get("blocked_user_ids", []))
        b_blocked = set(user_b.get("preferences", {}).get("blocked_user_ids", []))
        return user_b_id in a_blocked or user_a_id in b_blocked

    def create_user_session(user: dict, request: Request) -> str:
        """Create and attach a session record to user."""
        sid = secrets.token_urlsafe(24)
        sessions = user.setdefault("sessions", [])
        sessions.append(
            {
                "sid": sid,
                "created_at": datetime.utcnow().isoformat(),
                "last_seen_at": datetime.utcnow().isoformat(),
                "ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "unknown")[:180],
            }
        )
        user["sessions"] = sessions[-20:]
        return sid

    def validate_user_session(user: dict, sid: str) -> bool:
        """Check sid belongs to user, prune stale sessions and update last-seen timestamp."""
        now = datetime.utcnow()
        valid_sessions = []
        matched = False
        for s in user.get("sessions", []):
            try:
                created_at = datetime.fromisoformat(s.get("created_at"))
                last_seen = datetime.fromisoformat(s.get("last_seen_at", s.get("created_at")))
            except Exception:
                continue
            if now - created_at > SESSION_MAX_AGE:
                continue
            if now - last_seen > SESSION_IDLE_TIMEOUT:
                continue
            if s.get("sid") == sid:
                s["last_seen_at"] = now.isoformat()
                matched = True
            valid_sessions.append(s)
        user["sessions"] = valid_sessions[-20:]
        if matched:
            return True
        return False

    def record_sync_event(users: list[dict], actor_id: int, platform: str, action: str, reference: str) -> None:
        """Record a native sync event in a user's timeline."""
        for u in users:
            if u.get("id") == actor_id:
                u.setdefault("sync_events", []).append(
                    {
                        "platform": platform,
                        "action": action,
                        "reference": reference,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
                break

    def annotate_posts_for_user(
        viewer: dict,
        all_posts: list[dict],
        all_users: list[dict],
        author_ids: list[int],
        group_ids: Optional[set[int]] = None,
    ) -> list[dict]:
        """Build feed-safe post objects with author/comment metadata."""
        id_to_user: dict[int, dict] = {u["id"]: u for u in all_users}
        visible_posts = [
            p
            for p in all_posts
            if p.get("user_id") in author_ids
            or (group_ids and p.get("group_id") is not None and p.get("group_id") in group_ids)
        ]
        visible_posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)
        annotated_posts = []
        for p in visible_posts:
            author_id = p.get("user_id")
            if author_id and users_are_blocked(viewer["id"], author_id, all_users):
                continue
            annotated = p.copy()
            author = id_to_user.get(author_id)
            annotated["author"] = author.get("username") if author else "Unknown"
            likes = p.get("likes", [])
            annotated["like_count"] = len(likes)
            annotated["liked"] = viewer["id"] in likes
            comments_annotated = []
            for c in p.get("comments", []):
                commenter_id = c.get("user_id")
                if commenter_id and users_are_blocked(viewer["id"], commenter_id, all_users):
                    continue
                commenter = id_to_user.get(c.get("user_id"))
                comments_annotated.append(
                    {
                        "id": c.get("id"),
                        "user_id": c.get("user_id"),
                        "author": commenter.get("username") if commenter else "Unknown",
                        "content": c.get("content"),
                        "timestamp": c.get("timestamp"),
                    }
                )
            annotated["comments_annotated"] = comments_annotated
            annotated_posts.append(annotated)
        return annotated_posts

    def follower_count_for_user(target_user_id: int, users: list[dict]) -> int:
        """Count followers for a given user ID."""
        return sum(1 for u in users if target_user_id in u.get("following", []))

    def compute_dashboard_metrics(user: dict, users: list[dict], posts: list[dict]) -> dict:
        """Generate dashboard KPI cards for the current user."""
        following_count = len(user.get("following", []))
        followers_count = follower_count_for_user(user["id"], users)
        my_posts = [p for p in posts if p.get("user_id") == user["id"]]
        interactions = sum(len(p.get("likes", [])) + len(p.get("comments", [])) for p in my_posts)
        unread_notifications = sum(1 for n in user.get("notifications", []) if not n.get("read", False))
        unread_messages = sum(
            1
            for m in user.get("messages", [])
            if m.get("receiver_id") == user["id"] and not m.get("read_by_receiver", False)
        )
        return {
            "following_count": following_count,
            "followers_count": followers_count,
            "post_count": len(my_posts),
            "interactions": interactions,
            "unread_notifications": unread_notifications,
            "unread_messages": unread_messages,
            "group_count": len(user.get("preferences", {}).get("group_ids", [])),
        }

    def normalise_notifications(user: dict) -> list[dict]:
        """Ensure notifications always include read/priority metadata."""
        notifications = user.get("notifications", [])
        for notif in notifications:
            notif.setdefault("read", False)
            notif.setdefault("priority", "normal")
            notif.setdefault("type", "general")
        return notifications

    def build_message_threads(current_user: dict, users: list[dict]) -> list[dict]:
        """Group messages into MeChat conversation threads."""
        id_to_user: dict[int, dict] = {u["id"]: u for u in users}
        pinned = set(current_user.get("preferences", {}).get("pinned_threads", []))
        threads: dict[int, dict] = {}
        for m in current_user.get("messages", []):
            sender_id = m.get("sender_id")
            receiver_id = m.get("receiver_id")
            if sender_id is None or receiver_id is None:
                continue
            peer_id = receiver_id if sender_id == current_user["id"] else sender_id
            if peer_id == current_user["id"]:
                continue
            thread = threads.setdefault(
                peer_id,
                {
                    "peer_id": peer_id,
                    "peer_name": id_to_user.get(peer_id, {}).get("username", "Unknown"),
                    "last_message": "",
                    "last_platform": "mesh",
                    "last_timestamp": "",
                    "unread_count": 0,
                    "pinned": peer_id in pinned,
                },
            )
            ts = m.get("timestamp", "")
            if ts >= thread["last_timestamp"]:
                thread["last_timestamp"] = ts
                thread["last_message"] = m.get("message", "")
                thread["last_platform"] = m.get("platform", "mesh")
            if receiver_id == current_user["id"] and not m.get("read_by_receiver", False):
                thread["unread_count"] += 1
        return sorted(threads.values(), key=lambda t: (not t.get("pinned", False), t["last_timestamp"]), reverse=True)

    def next_message_id(users: list[dict]) -> int:
        """Generate a globally unique message ID across all user stores."""
        highest = 0
        for u in users:
            for m in u.get("messages", []):
                highest = max(highest, int(m.get("id", 0) or 0))
        return highest + 1

    def trending_tags(posts: list[dict], limit: int = 12) -> list[dict]:
        """Compute trending tags from post metadata."""
        counts: dict[str, int] = {}
        for p in posts:
            for tag in p.get("tags", []):
                key = str(tag).strip().lower()
                if not key:
                    continue
                counts[key] = counts.get(key, 0) + 1
        ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
        return [{"tag": tag, "count": count} for tag, count in ranked[:limit]]

    def suggested_accounts(current_user: dict, users: list[dict], posts: list[dict], limit: int = 8) -> list[dict]:
        """Generate creator suggestions based on activity and follow graph."""
        following_set = set(current_user.get("following", []))
        candidate_scores: list[tuple[dict, int]] = []
        for u in users:
            if u.get("id") == current_user.get("id"):
                continue
            if u.get("id") in following_set:
                continue
            post_count = sum(1 for p in posts if p.get("user_id") == u.get("id"))
            follower_score = follower_count_for_user(u.get("id"), users)
            score = (post_count * 2) + follower_score
            if score > 0:
                candidate_scores.append((u, score))
        candidate_scores.sort(key=lambda item: item[1], reverse=True)
        return [
            {
                "username": u.get("username"),
                "score": score,
                "followers": follower_count_for_user(u.get("id"), users),
            }
            for u, score in candidate_scores[:limit]
        ]

    def export_user_bundle(user: dict, posts: list[dict]) -> dict:
        """Create a privacy export payload for a user."""
        return {
            "account": {
                "id": user.get("id"),
                "username": user.get("username"),
                "email": user.get("email"),
                "preferences": user.get("preferences", {}),
            },
            "posts": [p for p in posts if p.get("user_id") == user.get("id")],
            "messages": user.get("messages", []),
            "notifications": user.get("notifications", []),
            "sync_events": user.get("sync_events", []),
            "privacy_requests": user.get("privacy_requests", []),
        }

    def enqueue_sync_job(
        actor_id: int,
        platform: str,
        action: str,
        reference: str,
        target_id: Optional[int] = None,
    ) -> None:
        """Append an external platform sync job to the queue."""
        jobs = load_sync_jobs()
        jobs.append(
            {
                "id": max((j.get("id", 0) for j in jobs), default=0) + 1,
                "actor_id": actor_id,
                "target_id": target_id,
                "platform": platform.lower(),
                "action": action,
                "reference": reference,
                "status": "queued",
                "attempts": 0,
                "last_error": "",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        save_sync_jobs(jobs)

    # Dependency to inject current user into routes if available
    def current_user_dep(request: Request) -> Optional[dict]:
        token = request.cookies.get(SESSION_COOKIE_NAME)
        sid = request.cookies.get(SESSION_ID_COOKIE_NAME)
        if not token:
            return None
        if not sid:
            return None
        user_id = decode_session_token(serializer, token)
        if user_id is None:
            return None
        users = load_users()
        user = find_user_by_id(user_id, users)
        if not user:
            return None
        if not validate_user_session(user, sid):
            return None
        save_users(users)
        return user

    @app.get("/", response_class=HTMLResponse)
    async def landing(request: Request, user: Optional[dict] = Depends(current_user_dep)):
        """Render the landing/login page or redirect to dashboard if already logged in."""
        if user:
            return RedirectResponse(url="/dashboard", status_code=303)
        return templates.TemplateResponse(
            "landing.html",
            {"request": request, "minimal": True, "error": None},
        )

    @app.post("/login", response_class=HTMLResponse)
    async def login(
        request: Request,
        identifier: str = Form(...),
        password: str = Form(...),
    ):
        """Authenticate a user and set a session cookie on success."""
        client_ip = request.client.host if request.client else "unknown"
        now = datetime.utcnow()
        attempts = login_attempts[client_ip]
        while attempts and (now - attempts[0]).total_seconds() > 900:
            attempts.popleft()
        if len(attempts) >= 10:
            log_security_event(None, "login_rate_limited", f"IP {client_ip}", "warning")
            context = {"request": request, "minimal": True, "error": "Too many attempts. Try again later."}
            return templates.TemplateResponse("landing.html", context, status_code=429)
        users = load_users()
        user = find_user_by_identifier(identifier.strip(), users)
        if not user or not verify_password(password, user["hashed_password"]):
            attempts.append(now)
            log_security_event(None, "login_failed", f"IP {client_ip} for identifier {identifier[:40]}", "warning")
            # Show an error on the landing page
            context = {"request": request, "minimal": True, "error": "Invalid username/email or password"}
            return templates.TemplateResponse("landing.html", context)
        # successful login -> clear attempts
        attempts.clear()
        log_security_event(user.get("id"), "login_success", f"IP {client_ip}", "info")
        prior_ips = {s.get("ip") for s in user.get("sessions", [])}
        sid = create_user_session(user, request)
        if client_ip not in prior_ips and prior_ips:
            user.setdefault("notifications", []).append(
                {
                    "platform": "mesh",
                    "content": f"New login detected from IP {client_ip}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "type": "security",
                    "priority": "high",
                    "read": False,
                }
            )
            log_security_event(user.get("id"), "new_login_ip", f"IP {client_ip}", "warning")
        save_users(users)
        # Create a signed session token and set it in a cookie
        token = create_session_token(serializer, user["id"])
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(
            SESSION_COOKIE_NAME,
            token,
            httponly=True,
            max_age=60 * 60 * 24 * 7,  # one week
            samesite="lax",
            secure=True,
        )
        response.set_cookie(
            SESSION_ID_COOKIE_NAME,
            sid,
            httponly=True,
            max_age=60 * 60 * 24 * 7,
            samesite="lax",
            secure=True,
        )
        response.set_cookie(
            CSRF_COOKIE_NAME,
            secrets.token_urlsafe(24),
            httponly=False,
            max_age=60 * 60 * 24 * 7,
            samesite="lax",
            secure=True,
        )
        return response

    @app.get("/signup", response_class=HTMLResponse)
    async def signup_get(request: Request):
        """Render the sign‑up page."""
        return templates.TemplateResponse(
            "signup.html",
            {"request": request, "minimal": True, "error": None},
        )

    @app.post("/signup", response_class=HTMLResponse)
    async def signup_post(
        request: Request,
        username: str = Form(...),
        email: str = Form(...),
        password: str = Form(...),
    ):
        """Create a new user account or display an error if invalid."""
        username = clean_text(username, 40)
        email = clean_text(email, 120).lower()
        if len(username) < 3:
            return templates.TemplateResponse(
                "signup.html",
                {"request": request, "minimal": True, "error": "Username must be at least 3 characters"},
            )
        if len(password) < 10:
            return templates.TemplateResponse(
                "signup.html",
                {"request": request, "minimal": True, "error": "Password must be at least 10 characters"},
            )
        users = load_users()
        # Check duplicates
        for u in users:
            if u["username"] == username or u["email"] == email:
                return templates.TemplateResponse(
                    "signup.html",
                    {"request": request, "minimal": True, "error": "Username or email already taken"},
                )
        # Determine next user ID
        next_id = max((u.get("id", 0) for u in users), default=0) + 1
        hashed_password = get_password_hash(password)
        # Populate new accounts with default preferences, messages and notifications so that
        # they can immediately customise their experience.  Preferences control feed layout,
        # whether notifications are delivered or summarised, and which platforms are connected.
        new_user = {
            "id": next_id,
            "username": username,
            "email": email,
            "hashed_password": hashed_password,
            "preferences": {
                "feed_layout": "instagram",
                "notifications_enabled": True,
                "summary_enabled": False,
                "connected_platforms": [],
                "read_receipts": True,
                "native_notifications_muted": False,
                "privacy_mode": "balanced",
                "group_ids": [],
                "blocked_user_ids": [],
                "profile_visibility": "public",
            },
            "messages": [],
            "notifications": [],
            "sync_events": [],
            "following": [],
        }
        users.append(new_user)
        sid = create_user_session(new_user, request)
        save_users(users)
        # Create session token and set cookie
        token = create_session_token(serializer, new_user["id"])
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(
            SESSION_COOKIE_NAME,
            token,
            httponly=True,
            max_age=60 * 60 * 24 * 7,
            samesite="lax",
            secure=True,
        )
        response.set_cookie(
            SESSION_ID_COOKIE_NAME,
            sid,
            httponly=True,
            max_age=60 * 60 * 24 * 7,
            samesite="lax",
            secure=True,
        )
        response.set_cookie(
            CSRF_COOKIE_NAME,
            secrets.token_urlsafe(24),
            httponly=False,
            max_age=60 * 60 * 24 * 7,
            samesite="lax",
            secure=True,
        )
        log_security_event(new_user.get("id"), "signup_success", f"user {username}", "info")
        return response

    @app.get("/dashboard", response_class=HTMLResponse)
    async def dashboard(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Show a simple dashboard or redirect to login if not authenticated."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        posts = load_posts()
        metrics = compute_dashboard_metrics(user, users, posts)
        suggestions = suggested_accounts(user, users, posts, limit=4)
        tags = trending_tags(posts, limit=6)
        return templates.TemplateResponse(
            "dashboard.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "metrics": metrics,
                "suggestions": suggestions,
                "trending": tags,
            },
        )

    @app.get("/logout")
    async def logout(request: Request):
        """Clear the session cookie and redirect to the landing page."""
        token = request.cookies.get(SESSION_COOKIE_NAME)
        sid = request.cookies.get(SESSION_ID_COOKIE_NAME)
        if token and sid:
            uid = decode_session_token(serializer, token)
            if uid is not None:
                users = load_users()
                for u in users:
                    if u.get("id") == uid:
                        u["sessions"] = [s for s in u.get("sessions", []) if s.get("sid") != sid]
                        break
                save_users(users)
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie(SESSION_COOKIE_NAME)
        response.delete_cookie(SESSION_ID_COOKIE_NAME)
        response.delete_cookie(CSRF_COOKIE_NAME)
        return response

    @app.get("/mesh", response_class=HTMLResponse)
    async def mesh_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display the mesh view – an interactive representation of the user's social graph."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        posts = load_posts()
        author_ids = [user["id"]] + user.get("following", [])
        related_posts = [p for p in posts if p.get("user_id") in author_ids]
        related_tags = sorted(
            {
                tag.strip().lower()
                for p in related_posts
                for tag in p.get("tags", [])
                if isinstance(tag, str) and tag.strip()
            }
        )
        mesh_stats = {
            "nodes": len(author_ids) + len(related_posts) + len(related_tags),
            "connections": len(user.get("following", [])) + len(related_posts) + len(related_tags),
            "posts": len(related_posts),
            "platforms": len(user.get("preferences", {}).get("connected_platforms", [])),
        }
        return templates.TemplateResponse(
            "mesh.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "mesh_stats": mesh_stats,
                "mesh_tags": related_tags[:24],
                "users": users,
            },
        )

    @app.get("/discover", response_class=HTMLResponse)
    async def discover_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Explore trending tags, active creators, and connected platform groups."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        posts = load_posts()
        tags = trending_tags(posts, limit=20)
        creators = suggested_accounts(user, users, posts, limit=12)
        platform_groups: dict[str, int] = {}
        for p in posts:
            platform = p.get("source_platform", "mesh")
            platform_groups[platform] = platform_groups.get(platform, 0) + 1
        groups = sorted(platform_groups.items(), key=lambda item: item[1], reverse=True)
        return templates.TemplateResponse(
            "discover.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "trending_tags": tags,
                "creators": creators,
                "groups": groups,
            },
        )

    @app.get("/groups", response_class=HTMLResponse)
    async def groups_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Browse and create groups."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        groups = load_groups()
        my_group_ids = set(user.get("preferences", {}).get("group_ids", []))
        trending = sorted(groups, key=lambda g: len(g.get("members", [])), reverse=True)
        return templates.TemplateResponse(
            "groups.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "groups": trending,
                "my_group_ids": my_group_ids,
            },
        )

    @app.post("/groups/create")
    async def groups_create(
        user: Optional[dict] = Depends(current_user_dep),
        name: str = Form(...),
        description: str = Form(""),
        tags: str = Form(""),
    ):
        """Create a new community group."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        clean_name = clean_text(name, 70)
        if not clean_name:
            return RedirectResponse(url="/groups", status_code=303)
        groups = load_groups()
        group_id = max((g.get("id", 0) for g in groups), default=0) + 1
        groups.append(
            {
                "id": group_id,
                "name": clean_name[:70],
                "description": clean_text(description, 240),
                "owner_id": user.get("id"),
                "members": [user.get("id")],
                "tags": [t.strip().lower() for t in tags.split(",") if t.strip()][:12],
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        save_groups(groups)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                gids = prefs.setdefault("group_ids", [])
                if group_id not in gids:
                    gids.append(group_id)
                user["preferences"]["group_ids"] = gids
                break
        save_users(users)
        return RedirectResponse(url=f"/groups/{group_id}", status_code=303)

    @app.post("/groups/{group_id}/join")
    async def groups_join(
        group_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Join a group."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        groups = load_groups()
        for g in groups:
            if g.get("id") == group_id:
                members = g.setdefault("members", [])
                if user.get("id") not in members:
                    members.append(user.get("id"))
                break
        save_groups(groups)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                gids = prefs.setdefault("group_ids", [])
                if group_id not in gids:
                    gids.append(group_id)
                user["preferences"]["group_ids"] = gids
                break
        save_users(users)
        return RedirectResponse(url=f"/groups/{group_id}", status_code=303)

    @app.post("/groups/{group_id}/leave")
    async def groups_leave(
        group_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Leave a group."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        groups = load_groups()
        for g in groups:
            if g.get("id") == group_id:
                members = g.setdefault("members", [])
                if user.get("id") in members:
                    members.remove(user.get("id"))
                break
        save_groups(groups)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                gids = prefs.setdefault("group_ids", [])
                if group_id in gids:
                    gids.remove(group_id)
                user["preferences"]["group_ids"] = gids
                break
        save_users(users)
        return RedirectResponse(url="/groups", status_code=303)

    @app.get("/groups/{group_id}", response_class=HTMLResponse)
    async def group_detail_view(
        request: Request,
        group_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Show one group and its dedicated posts."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        groups = load_groups()
        group = next((g for g in groups if g.get("id") == group_id), None)
        if group is None:
            return Response(content="Group not found", status_code=404)
        posts = load_posts()
        users = load_users()
        id_to_user = {u["id"]: u for u in users}
        group_posts = [p for p in posts if p.get("group_id") == group_id]
        group_posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)
        for p in group_posts:
            p["author"] = id_to_user.get(p.get("user_id"), {}).get("username", "Unknown")
        is_member = user.get("id") in group.get("members", [])
        return templates.TemplateResponse(
            "group_detail.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "group": group,
                "posts": group_posts,
                "is_member": is_member,
            },
        )

    @app.post("/groups/{group_id}/post")
    async def group_post_create(
        group_id: int,
        title: str = Form(...),
        content: str = Form(...),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Create a post scoped to a group."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        groups = load_groups()
        group = next((g for g in groups if g.get("id") == group_id), None)
        if group is None:
            return Response(content="Group not found", status_code=404)
        if user.get("id") not in group.get("members", []):
            return Response(content="Join group first", status_code=403)
        posts = load_posts()
        new_post_id = max((p.get("id", 0) for p in posts), default=0) + 1
        posts.append(
            {
                "id": new_post_id,
                "user_id": user.get("id"),
                "title": title.strip()[:120],
                "content": content.strip(),
                "timestamp": datetime.utcnow().isoformat(),
                "likes": [],
                "comments": [],
                "source_platform": "mesh",
                "external_post_id": None,
                "external_url": "",
                "tags": group.get("tags", [])[:6],
                "group_id": group_id,
            }
        )
        save_posts(posts)
        enqueue_sync_job(
            actor_id=user.get("id"),
            platform="mesh",
            action="group_post",
            reference=f"{group.get('name')} · {title.strip()[:40]}",
            target_id=group_id,
        )
        return RedirectResponse(url=f"/groups/{group_id}", status_code=303)

    @app.get("/feed", response_class=HTMLResponse)
    async def feed_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        layout: str | None = None,
        platform: str | None = None,
    ):
        """Display the user's custom feed.

        A query parameter ``layout`` allows the user to select a UI style (e.g. instagram, youtube, tiktok).
        """
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Determine layout from query parameter or user preferences; fall back to a sensible default.
        default_layout = user.get("preferences", {}).get("feed_layout", "instagram") if user else "instagram"
        query_layout = request.query_params.get("layout") or layout or default_layout
        all_posts = load_posts()
        all_users = load_users()
        author_ids: list[int] = [user["id"]] + user.get("following", [])
        group_ids = set(user.get("preferences", {}).get("group_ids", []))
        feed_posts = annotate_posts_for_user(user, all_posts, all_users, author_ids, group_ids=group_ids)
        platform_filter = (request.query_params.get("platform") or platform or "all").lower()
        if platform_filter != "all":
            feed_posts = [p for p in feed_posts if p.get("source_platform", "mesh").lower() == platform_filter]
        return templates.TemplateResponse(
            "feed.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "layout": query_layout,
                "platform_filter": platform_filter,
                "posts": feed_posts,
                "connected_platforms": user.get("preferences", {}).get("connected_platforms", []),
                "feed_presets": user.get("preferences", {}).get("feed_presets", []),
            },
        )

    @app.post("/feed/preset/save")
    async def feed_save_preset(
        user: Optional[dict] = Depends(current_user_dep),
        layout: str = Form(...),
        platform: str = Form("all"),
        name: str = Form(""),
    ):
        """Save a reusable custom-feed preset for the current user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        preset_name = (name or "").strip() or f"{layout.capitalize()} · {platform.capitalize()}"
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                presets = prefs.setdefault("feed_presets", [])
                presets.append(
                    {
                        "name": preset_name[:50],
                        "layout": layout.lower(),
                        "platform": platform.lower(),
                        "created_at": datetime.utcnow().isoformat(),
                    }
                )
                prefs["feed_presets"] = presets[-8:]
                user["preferences"]["feed_presets"] = prefs["feed_presets"]
                break
        save_users(users)
        return RedirectResponse(url=f"/feed?layout={layout}&platform={platform}", status_code=303)

    def summarize_notifications(notifications: list[dict]) -> list[str]:
        """Produce a simple summary of notification counts by platform/type.

        When notifications are numerous, a concise overview helps users prioritise their attention.
        This function groups notifications by platform name and returns sentences describing the
        number of unread notifications per platform."""
        counts: dict[str, int] = {}
        for n in notifications:
            plat = n.get("platform", "other")
            counts[plat] = counts.get(plat, 0) + 1
        summary = []
        for plat, count in counts.items():
            name = plat.capitalize()
            summary.append(f"{count} new {name} notification{'s' if count != 1 else ''}")
        return summary

    @app.get("/notifications", response_class=HTMLResponse)
    async def notifications_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display the user's notifications and (optionally) a summary."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        notifications = normalise_notifications(user)
        sync_events = sorted(user.get("sync_events", []), key=lambda e: e.get("timestamp", ""), reverse=True)[:20]
        unread_count = sum(1 for n in notifications if not n.get("read", False))
        summary: list[str] = []
        # Only compute a summary if the user has enabled summaries in preferences
        if user.get("preferences", {}).get("summary_enabled", False) and notifications:
            summary = summarize_notifications(notifications)
        return templates.TemplateResponse(
            "notifications.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "notifications": notifications,
                "summary": summary,
                "sync_events": sync_events,
                "unread_count": unread_count,
            },
        )

    @app.post("/notifications/mark-read")
    async def notifications_mark_read(
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Mark all user notifications as read."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                notifications = u.get("notifications", [])
                for n in notifications:
                    n["read"] = True
                user["notifications"] = notifications
                break
        save_users(users)
        return RedirectResponse(url="/notifications", status_code=303)

    @app.post("/notifications/digest")
    async def notifications_digest(
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Generate a digest notification from unread notifications."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                notifications = normalise_notifications(u)
                unread = [n for n in notifications if not n.get("read", False)]
                if unread:
                    digest_items = summarize_notifications(unread)
                    digest = {
                        "platform": "mesh",
                        "content": "Digest: " + " • ".join(digest_items[:4]),
                        "timestamp": datetime.utcnow().isoformat(),
                        "read": False,
                        "priority": "high",
                        "type": "digest",
                    }
                    notifications.append(digest)
                break
        save_users(users)
        return RedirectResponse(url="/notifications", status_code=303)

    @app.get("/messages", response_class=HTMLResponse)
    async def messages_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        q: str | None = None,
        platform: str | None = None,
    ):
        """Display a unified message view across connected platforms (MeChat)."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Retrieve the user's message history.  Messages may come from various
        # platforms and are stored as dictionaries.  To support both legacy
        # messages (with ``sender`` and ``platform`` keys) and newer records
        # (with ``sender_id`` and ``receiver_id``), normalise each entry.
        raw_messages = user.get("messages", [])
        users = load_users()
        id_to_user: dict[int, dict] = {u["id"]: u for u in users}
        normalised: list[dict] = []
        for m in raw_messages:
            m_copy = m.copy()
            # Determine sender name and platform
            sender_name = m_copy.get("sender")
            msg_platform = m_copy.get("platform", "mesh")
            if sender_name is None and "sender_id" in m_copy:
                sender_name = id_to_user.get(m_copy.get("sender_id"), {}).get("username", "Unknown")
            if msg_platform is None:
                msg_platform = "mesh"
            m_copy.setdefault("read_by_receiver", False)
            m_copy.setdefault("read_at", None)
            m_copy.setdefault("id", 0)
            m_copy.setdefault("reactions", [])
            m_copy.setdefault("reply_to_id", None)
            m_copy.setdefault("attachment_url", "")
            m_copy.setdefault("edited_at", None)
            m_copy.setdefault("deleted", False)
            m_copy.setdefault("delivered_at", m_copy.get("timestamp"))
            m_copy["sender"] = sender_name
            m_copy["platform"] = msg_platform
            normalised.append(m_copy)
        search = clean_text(request.query_params.get("q") or q or "", 100).lower()
        platform_filter = (request.query_params.get("platform") or platform or "all").lower()
        if search:
            normalised = [m for m in normalised if search in str(m.get("message", "")).lower() or search in str(m.get("sender", "")).lower()]
        if platform_filter != "all":
            normalised = [m for m in normalised if str(m.get("platform", "mesh")).lower() == platform_filter]
        # Sort messages chronologically by timestamp (ISO strings compare lexicographically)
        messages_sorted = sorted(normalised, key=lambda m: m.get("timestamp", ""))
        threads = build_message_threads(user, users)
        # Add group chat threads from message records containing group_id.
        groups = {g.get("id"): g for g in load_groups()}
        group_threads: dict[int, dict] = {}
        for m in normalised:
            gid = m.get("group_id")
            if not gid:
                continue
            gt = group_threads.setdefault(
                gid,
                {
                    "group_id": gid,
                    "group_name": groups.get(gid, {}).get("name", f"Group {gid}"),
                    "last_message": "",
                    "last_timestamp": "",
                    "last_platform": m.get("platform", "mesh"),
                },
            )
            if m.get("timestamp", "") >= gt["last_timestamp"]:
                gt["last_timestamp"] = m.get("timestamp", "")
                gt["last_message"] = m.get("message", "")
                gt["last_platform"] = m.get("platform", "mesh")
        group_threads_list = sorted(group_threads.values(), key=lambda g: g["last_timestamp"], reverse=True)
        return templates.TemplateResponse(
            "messages.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "messages": messages_sorted,
                "threads": threads,
                "group_threads": group_threads_list,
                "search": search,
                "platform_filter": platform_filter,
                "platforms": user.get("preferences", {}).get("connected_platforms", []),
            },
        )

    @app.post("/messages/{peer_id}/read")
    async def messages_mark_thread_read(
        peer_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Mark incoming messages from a given peer as read."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                for m in u.get("messages", []):
                    if (
                        m.get("sender_id") == peer_id
                        and m.get("receiver_id") == user["id"]
                        and not m.get("read_by_receiver", False)
                    ):
                        m["read_by_receiver"] = True
                        m["read_at"] = datetime.utcnow().isoformat()
                break
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)

    @app.post("/messages/{peer_id}/pin")
    async def message_thread_pin(
        peer_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Pin a direct thread in MeChat."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                pins = prefs.setdefault("pinned_threads", [])
                if peer_id not in pins:
                    pins.append(peer_id)
                user["preferences"]["pinned_threads"] = pins
                break
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)

    @app.post("/messages/{peer_id}/unpin")
    async def message_thread_unpin(
        peer_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Unpin a direct thread in MeChat."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                pins = prefs.setdefault("pinned_threads", [])
                if peer_id in pins:
                    pins.remove(peer_id)
                user["preferences"]["pinned_threads"] = pins
                break
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)

    @app.get("/messages/group/{group_id}", response_class=HTMLResponse)
    async def message_group_view(
        request: Request,
        group_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """View a group chat channel."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        group = next((g for g in load_groups() if g.get("id") == group_id), None)
        if not group:
            return Response(content="Group not found", status_code=404)
        if user.get("id") not in group.get("members", []):
            return Response(content="Join group first", status_code=403)
        msgs = []
        users = load_users()
        id_to_user = {u["id"]: u.get("username") for u in users}
        for m in user.get("messages", []):
            if m.get("group_id") == group_id:
                m_copy = m.copy()
                m_copy["sender_name"] = id_to_user.get(m.get("sender_id"), "Unknown")
                msgs.append(m_copy)
        msgs.sort(key=lambda x: x.get("timestamp", ""))
        return templates.TemplateResponse(
            "mechat_group.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "group": group,
                "messages": msgs,
                "platforms": user.get("preferences", {}).get("connected_platforms", []),
            },
        )

    @app.post("/messages/group/{group_id}")
    async def message_group_send(
        group_id: int,
        message: str = Form(...),
        platform: str = Form("mesh"),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Send a group MeChat message to all group members."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        if is_rate_limited(message_attempts[user.get("id")], max_events=20, window_seconds=60):
            log_security_event(user.get("id"), "message_rate_limited", "group message rate limit exceeded", "warning")
            return Response(content="Too many messages sent. Please slow down.", status_code=429)
        groups = load_groups()
        group = next((g for g in groups if g.get("id") == group_id), None)
        if not group:
            return Response(content="Group not found", status_code=404)
        if user.get("id") not in group.get("members", []):
            return Response(content="Join group first", status_code=403)
        text = clean_text(message, 2000)
        if not text:
            return RedirectResponse(url=f"/messages/group/{group_id}", status_code=303)
        users = load_users()
        msg = {
            "id": next_message_id(users),
            "sender_id": user.get("id"),
            "receiver_id": None,
            "group_id": group_id,
            "message": text,
            "platform": platform.lower(),
            "timestamp": datetime.utcnow().isoformat(),
            "delivered_at": datetime.utcnow().isoformat(),
            "read_by_receiver": False,
            "read_at": None,
            "reactions": [],
            "reply_to_id": None,
            "attachment_url": "",
            "edited_at": None,
            "deleted": False,
        }
        member_ids = set(group.get("members", []))
        for u in users:
            if u.get("id") in member_ids:
                u.setdefault("messages", []).append(msg)
        save_users(users)
        enqueue_sync_job(user.get("id"), platform.lower(), "group_message", f"group {group.get('name')}", group_id)
        return RedirectResponse(url=f"/messages/group/{group_id}", status_code=303)

    @app.get("/messages/thread/{peer_username}", response_class=HTMLResponse)
    async def message_thread_view(
        request: Request,
        peer_username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Show a focused MeChat conversation thread with one user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        peer = next((u for u in users if u.get("username") == peer_username), None)
        if not peer:
            return Response(content="Conversation user not found", status_code=404)
        if users_are_blocked(user.get("id"), peer.get("id"), users):
            return Response(content="Cannot access this thread due to privacy settings.", status_code=403)
        thread_messages = []
        for m in user.get("messages", []):
            sender_id = m.get("sender_id")
            receiver_id = m.get("receiver_id")
            if {sender_id, receiver_id} == {user.get("id"), peer.get("id")}:
                m_copy = m.copy()
                m_copy.setdefault("id", 0)
                m_copy.setdefault("reactions", [])
                m_copy.setdefault("reply_to_id", None)
                m_copy.setdefault("attachment_url", "")
                m_copy.setdefault("edited_at", None)
                m_copy.setdefault("deleted", False)
                m_copy.setdefault("delivered_at", m_copy.get("timestamp"))
                m_copy["is_mine"] = sender_id == user.get("id")
                thread_messages.append(m_copy)
        thread_messages.sort(key=lambda m: m.get("timestamp", ""))
        peer_typing = False
        peer_state = peer.get("typing_state", {}) if isinstance(peer.get("typing_state", {}), dict) else {}
        if peer_state.get("to_user_id") == user.get("id"):
            try:
                ts = datetime.fromisoformat(peer_state.get("timestamp"))
                peer_typing = (datetime.utcnow() - ts).total_seconds() < 20
            except Exception:
                peer_typing = False
        return templates.TemplateResponse(
            "mechat_thread.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "peer": peer,
                "messages": thread_messages,
                "platforms": user.get("preferences", {}).get("connected_platforms", []),
                "peer_typing": peer_typing,
            },
        )

    @app.post("/messages/thread/{peer_username}")
    async def message_thread_send(
        peer_username: str,
        message: str = Form(...),
        platform: str = Form("mesh"),
        attachment_url: str = Form(""),
        reply_to_id: int = Form(0),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Send a message from the focused thread view."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        if is_rate_limited(message_attempts[user.get("id")], max_events=20, window_seconds=60):
            log_security_event(user.get("id"), "message_rate_limited", f"thread message rate limit exceeded to {peer_username}", "warning")
            return Response(content="Too many messages sent. Please slow down.", status_code=429)
        users = load_users()
        peer = next((u for u in users if u.get("username") == peer_username), None)
        if not peer:
            return Response(content="Conversation user not found", status_code=404)
        if users_are_blocked(user.get("id"), peer.get("id"), users):
            return Response(content="Cannot send messages due to privacy settings.", status_code=403)
        text = clean_text(message, 2000)
        if not text:
            return RedirectResponse(url=f"/messages/thread/{peer_username}", status_code=303)
        msg_obj = {
            "id": next_message_id(users),
            "sender_id": user.get("id"),
            "receiver_id": peer.get("id"),
            "message": text,
            "platform": platform.lower(),
            "timestamp": datetime.utcnow().isoformat(),
            "delivered_at": datetime.utcnow().isoformat(),
            "read_by_receiver": False,
            "read_at": None,
            "reactions": [],
            "reply_to_id": reply_to_id if reply_to_id > 0 else None,
            "attachment_url": clean_text(attachment_url, 1000),
            "edited_at": None,
            "deleted": False,
        }
        for u in users:
            if u.get("id") in {user.get("id"), peer.get("id")}:
                u.setdefault("messages", []).append(msg_obj)
        save_users(users)
        enqueue_sync_job(user.get("id"), platform.lower(), "message", f"to {peer_username}", peer.get("id"))
        return RedirectResponse(url=f"/messages/thread/{peer_username}", status_code=303)

    @app.post("/messages/thread/{peer_username}/typing")
    async def message_thread_typing(
        peer_username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Update typing indicator state for a direct thread."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        peer = next((u for u in users if u.get("username") == peer_username), None)
        if not peer:
            return Response(content="Conversation user not found", status_code=404)
        if users_are_blocked(user.get("id"), peer.get("id"), users):
            return Response(content="Cannot update typing state for this thread.", status_code=403)
        for u in users:
            if u.get("id") == user.get("id"):
                u["typing_state"] = {
                    "to_user_id": peer.get("id"),
                    "timestamp": datetime.utcnow().isoformat(),
                }
                user["typing_state"] = u["typing_state"]
                break
        save_users(users)
        return RedirectResponse(url=f"/messages/thread/{peer_username}", status_code=303)

    @app.post("/messages/{message_id}/edit")
    async def message_edit(
        message_id: int,
        message: str = Form(...),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Edit an owned message for both participants."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        new_text = clean_text(message, 2000)
        users = load_users()
        peer_name = None
        for u in users:
            for m in u.get("messages", []):
                if int(m.get("id", 0) or 0) == message_id and m.get("sender_id") == user.get("id"):
                    m["message"] = new_text
                    m["edited_at"] = datetime.utcnow().isoformat()
                    if peer_name is None:
                        peer = next((x for x in users if x.get("id") == m.get("receiver_id")), None)
                        peer_name = peer.get("username") if peer else None
        save_users(users)
        log_security_event(user.get("id"), "message_edit", f"message_id={message_id}", "info")
        return RedirectResponse(url=f"/messages/thread/{peer_name}" if peer_name else "/messages", status_code=303)

    @app.post("/messages/{message_id}/unsend")
    async def message_unsend(
        message_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Unsend an owned message while preserving timeline integrity."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        peer_name = None
        for u in users:
            for m in u.get("messages", []):
                if int(m.get("id", 0) or 0) == message_id and m.get("sender_id") == user.get("id"):
                    m["deleted"] = True
                    m["message"] = "This message was unsent."
                    m["attachment_url"] = ""
                    m["edited_at"] = datetime.utcnow().isoformat()
                    if peer_name is None:
                        peer = next((x for x in users if x.get("id") == m.get("receiver_id")), None)
                        peer_name = peer.get("username") if peer else None
        save_users(users)
        log_security_event(user.get("id"), "message_unsend", f"message_id={message_id}", "info")
        return RedirectResponse(url=f"/messages/thread/{peer_name}" if peer_name else "/messages", status_code=303)

    @app.post("/messages/{message_id}/delete")
    async def message_delete(
        message_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Delete an owned message from both participants' histories."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        sender_name: Optional[str] = None
        for u in users:
            filtered = []
            for m in u.get("messages", []):
                if int(m.get("id", 0) or 0) == message_id and m.get("sender_id") == user.get("id"):
                    if sender_name is None:
                        sender_name = next((x.get("username") for x in users if x.get("id") == m.get("receiver_id")), None)
                    continue
                filtered.append(m)
            u["messages"] = filtered
        save_users(users)
        log_security_event(user.get("id"), "message_delete", f"message_id={message_id}", "info")
        redirect_target = f"/messages/thread/{sender_name}" if sender_name else "/messages"
        return RedirectResponse(url=redirect_target, status_code=303)

    @app.post("/messages/{message_id}/react")
    async def message_react(
        message_id: int,
        emoji: str = Form("👍"),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Add a reaction to a message."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        chosen = (emoji or "👍")[:4]
        users = load_users()
        for u in users:
            for m in u.get("messages", []):
                if int(m.get("id", 0) or 0) == message_id:
                    reactions = m.setdefault("reactions", [])
                    reactions.append({"user_id": user.get("id"), "emoji": chosen, "timestamp": datetime.utcnow().isoformat()})
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)

    @app.get("/connect", response_class=HTMLResponse)
    async def connect_get(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Render a form for the user to select which social platforms to connect."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # In a future implementation these would be dynamically discovered from available connectors
        supported_platforms = ["instagram", "youtube", "tiktok", "twitter", "facebook", "reddit"]
        return templates.TemplateResponse(
            "connect.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "supported_platforms": supported_platforms,
            },
        )

    @app.post("/connect", response_class=HTMLResponse)
    async def connect_post(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        platforms: list[str] = Form(None),
    ):
        """Handle submission of the connection form, updating user preferences."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Normalise platforms to a list
        chosen = platforms if isinstance(platforms, list) else ([] if platforms is None else [platforms])
        users = load_users()
        # Update the current user's record in the loaded users list
        for u in users:
            if u.get("id") == user.get("id"):
                u["preferences"]["connected_platforms"] = chosen
                # refresh the user variable to reflect changes
                user["preferences"]["connected_platforms"] = chosen
                break
        save_users(users)
        return RedirectResponse(url="/connect", status_code=303)

    @app.get("/settings", response_class=HTMLResponse)
    async def settings_get(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display account settings for feed layout and notification preferences."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        return templates.TemplateResponse(
            "settings.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
            },
        )

    @app.post("/settings", response_class=HTMLResponse)
    async def settings_post(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        feed_layout: str = Form(...),
        notifications_enabled: Optional[str] = Form(None),
        summary_enabled: Optional[str] = Form(None),
        read_receipts: Optional[str] = Form(None),
        native_notifications_muted: Optional[str] = Form(None),
        privacy_mode: str = Form("balanced"),
        profile_visibility: str = Form("public"),
    ):
        """Persist user preference changes from the settings page."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Convert checkbox values ("on" or None) to booleans
        notif_on = notifications_enabled is not None
        summary_on = summary_enabled is not None
        read_on = read_receipts is not None
        mute_native_on = native_notifications_muted is not None
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                prefs["feed_layout"] = feed_layout
                prefs["notifications_enabled"] = notif_on
                prefs["summary_enabled"] = summary_on
                prefs["read_receipts"] = read_on
                prefs["native_notifications_muted"] = mute_native_on
                prefs["privacy_mode"] = privacy_mode if privacy_mode in {"private", "balanced", "open"} else "balanced"
                prefs["profile_visibility"] = profile_visibility if profile_visibility in {"public", "private"} else "public"
                # update current user context
                user["preferences"] = prefs
                break
        save_users(users)
        return RedirectResponse(url="/settings", status_code=303)

    # ----------------------------------------------------------------------
    # Posts and social interactions
    #
    # The following endpoints implement a simple social feed for MeshMe.  Users
    # can create posts, view a feed composed of their own posts and those of
    # accounts they follow, like or unlike posts, comment on posts and manage
    # follow relationships.  Posts are stored in the ``posts.json`` file and
    # notifications are delivered to post authors when their posts are liked
    # or commented upon.  A profile page allows browsing another user's
    # posts and following or unfollowing them.

    @app.get("/posts", response_class=HTMLResponse)
    async def posts_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        layout: str | None = None,
        platform: str | None = None,
    ):
        """Display a feed of posts for the current user.

        The feed includes posts authored by the logged‑in user as well as
        accounts they follow.  Posts are sorted in reverse chronological
        order.  Each post record is annotated with display metadata
        (author username, like count, whether the current user has liked
        the post, and comment author names) before rendering.  A query
        parameter ``layout`` can override the feed layout defined in
        user preferences (e.g. instagram, youtube, tiktok, twitter).
        """
        if not user:
            return RedirectResponse(url="/", status_code=303)
        all_posts = load_posts()
        all_users = load_users()
        author_ids: list[int] = [user["id"]] + user.get("following", [])
        group_ids = set(user.get("preferences", {}).get("group_ids", []))
        annotated_posts = annotate_posts_for_user(user, all_posts, all_users, author_ids, group_ids=group_ids)
        platform_filter = (request.query_params.get("platform") or platform or "all").lower()
        if platform_filter != "all":
            annotated_posts = [p for p in annotated_posts if p.get("source_platform", "mesh").lower() == platform_filter]
        # Determine layout
        default_layout = user.get("preferences", {}).get("feed_layout", "instagram")
        query_layout = request.query_params.get("layout") or layout or default_layout
        return templates.TemplateResponse(
            "posts.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "layout": query_layout,
                "platform_filter": platform_filter,
                "posts": annotated_posts,
            },
        )

    @app.get("/post/new", response_class=HTMLResponse)
    async def new_post_get(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Render a form for creating a new post."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        return templates.TemplateResponse(
            "create_post.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
            },
        )

    @app.post("/post/new", response_class=HTMLResponse)
    async def new_post_post(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        title: str = Form(...),
        content: str = Form(...),
        source_platform: str = Form("mesh"),
        external_post_id: str = Form(""),
        external_url: str = Form(""),
        tags: str = Form(""),
    ):
        """Create a new post for the current user and persist it."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        title = clean_text(title, 120)
        content = clean_text(content, 2500)
        if not title or not content:
            return templates.TemplateResponse(
                "create_post.html",
                {
                    "request": request,
                    "minimal": False,
                    "user": user,
                    "error": "Title and content are required",
                },
            )
        posts = load_posts()
        # Determine next post ID
        next_id = max((p.get("id", 0) for p in posts), default=0) + 1
        timestamp = datetime.utcnow().isoformat()
        cleaned_tags = [t.strip().lower() for t in tags.split(",") if t.strip()]
        new_post_record = {
            "id": next_id,
            "user_id": user["id"],
            "title": title,
            "content": content,
            "timestamp": timestamp,
            "likes": [],
            "comments": [],
            "source_platform": source_platform.lower(),
            "external_post_id": external_post_id.strip() or None,
            "external_url": external_url.strip(),
            "tags": cleaned_tags[:12],
        }
        posts.append(new_post_record)
        save_posts(posts)
        return RedirectResponse(url="/posts", status_code=303)

    @app.post("/posts/{post_id}/like", response_class=HTMLResponse)
    async def like_post(
        request: Request,
        post_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Toggle the current user's like on a post and notify the author."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        posts = load_posts()
        users = load_users()
        updated = False
        for p in posts:
            if p.get("id") == post_id:
                if users_are_blocked(user["id"], p.get("user_id"), users):
                    return Response(content="Cannot interact with this post due to privacy settings.", status_code=403)
                likes: list[int] = p.setdefault("likes", [])
                if user["id"] in likes:
                    likes.remove(user["id"])
                else:
                    likes.append(user["id"])
                    platform = p.get("source_platform", "mesh")
                    record_sync_event(
                        users=users,
                        actor_id=user["id"],
                        platform=platform,
                        action="like",
                        reference=p.get("title", "post"),
                    )
                    enqueue_sync_job(
                        actor_id=user["id"],
                        platform=platform,
                        action="like",
                        reference=p.get("title", "post"),
                        target_id=p.get("user_id"),
                    )
                    # Create a notification for the post author (if not self)
                    if user["id"] != p.get("user_id"):
                        author_id = p.get("user_id")
                        for u in users:
                            if u.get("id") == author_id:
                                notif = {
                                    "platform": p.get("source_platform", "mesh"),
                                    "content": f"{user['username']} liked your post \"{p['title']}\" (synced via mesh.me)",
                                    "timestamp": datetime.utcnow().isoformat(),
                                }
                                u.setdefault("notifications", []).append(notif)
                                break
                    save_users(users)
                updated = True
                break
        if updated:
            save_posts(posts)
        return RedirectResponse(url="/posts", status_code=303)

    @app.post("/posts/{post_id}/comment", response_class=HTMLResponse)
    async def comment_post(
        request: Request,
        post_id: int,
        user: Optional[dict] = Depends(current_user_dep),
        comment: str = Form(...),
    ):
        """Add a comment to a post and notify the author."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        text = clean_text(comment, 800)
        if not text:
            return RedirectResponse(url=f"/posts", status_code=303)
        posts = load_posts()
        users = load_users()
        for p in posts:
            if p.get("id") == post_id:
                if users_are_blocked(user["id"], p.get("user_id"), users):
                    return Response(content="Cannot interact with this post due to privacy settings.", status_code=403)
                comments: list[dict] = p.setdefault("comments", [])
                new_comment_id = max((c.get("id", 0) for c in comments), default=0) + 1
                comments.append(
                    {
                        "id": new_comment_id,
                        "user_id": user["id"],
                        "content": text,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
                platform = p.get("source_platform", "mesh")
                record_sync_event(users, user["id"], platform, "comment", p.get("title", "post"))
                enqueue_sync_job(
                    actor_id=user["id"],
                    platform=platform,
                    action="comment",
                    reference=p.get("title", "post"),
                    target_id=p.get("user_id"),
                )
                # Notification for author if commenter is not the same person
                if user["id"] != p.get("user_id"):
                    author_id = p.get("user_id")
                    for u in users:
                        if u.get("id") == author_id:
                            notif = {
                                "platform": platform,
                                "content": f"{user['username']} commented on your post \"{p['title']}\" (synced via mesh.me)",
                                "timestamp": datetime.utcnow().isoformat(),
                            }
                            u.setdefault("notifications", []).append(notif)
                            break
                save_users(users)
                break
        save_posts(posts)
        return RedirectResponse(url="/posts", status_code=303)

    @app.post("/posts/{post_id}/report")
    async def report_post(
        post_id: int,
        reason: str = Form(""),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Submit a moderation report for a post."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        posts = load_posts()
        target_post = next((p for p in posts if p.get("id") == post_id), None)
        if target_post is None:
            return Response(content="Post not found", status_code=404)
        reports = load_reports()
        reports.append(
            {
                "id": max((r.get("id", 0) for r in reports), default=0) + 1,
                "post_id": post_id,
                "reported_by": user.get("id"),
                "post_owner": target_post.get("user_id"),
                "reason": reason.strip() or "Not specified",
                "timestamp": datetime.utcnow().isoformat(),
                "status": "open",
            }
        )
        save_reports(reports)
        enqueue_sync_job(
            actor_id=user.get("id"),
            platform=target_post.get("source_platform", "mesh"),
            action="report",
            reference=target_post.get("title", "post"),
            target_id=target_post.get("user_id"),
        )
        users = load_users()
        for u in users:
            if u.get("id") == target_post.get("user_id"):
                u.setdefault("notifications", []).append(
                    {
                        "platform": "mesh",
                        "content": f"A post was reported for moderation: \"{target_post.get('title', 'post')}\"",
                        "timestamp": datetime.utcnow().isoformat(),
                        "type": "moderation",
                        "priority": "high",
                        "read": False,
                    }
                )
                break
        save_users(users)
        return RedirectResponse(url="/posts", status_code=303)

    @app.get("/user/{username}", response_class=HTMLResponse)
    async def profile_view(
        request: Request,
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display another user's profile, their posts and follow/unfollow options."""
        # Load users and find the target by username
        users = load_users()
        target: Optional[dict] = None
        for u in users:
            if u.get("username") == username:
                target = u
                break
        if target is None:
            return Response(content="User not found", status_code=404)
        target_prefs = target.get("preferences", {})
        visibility = target_prefs.get("profile_visibility", "public")
        blocked_by_target = user and user.get("id") in target_prefs.get("blocked_user_ids", [])
        viewer_blocked_target = user and target.get("id") in user.get("preferences", {}).get("blocked_user_ids", [])
        if blocked_by_target:
            return Response(content="This profile is unavailable.", status_code=403)
        if viewer_blocked_target and user.get("id") != target.get("id"):
            return Response(content="You have blocked this user.", status_code=403)
        if visibility == "private" and (not user or user.get("id") != target.get("id")):
            return Response(content="This profile is private.", status_code=403)
        # Prepare posts by target
        posts = [p for p in load_posts() if p.get("user_id") == target.get("id")]
        posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)
        id_to_user: dict[int, dict] = {u["id"]: u for u in users}
        annotated_posts = []
        for p in posts:
            annotated = p.copy()
            annotated["author"] = target.get("username")
            annotated["like_count"] = len(p.get("likes", []))
            annotated["liked"] = user and user.get("id") in p.get("likes", [])
            comments = p.get("comments", [])
            comments_annotated = []
            for c in comments:
                commenter = id_to_user.get(c.get("user_id"))
                comments_annotated.append(
                    {
                        "id": c.get("id"),
                        "user_id": c.get("user_id"),
                        "author": commenter.get("username") if commenter else "Unknown",
                        "content": c.get("content"),
                        "timestamp": c.get("timestamp"),
                    }
                )
            annotated["comments_annotated"] = comments_annotated
            annotated_posts.append(annotated)
        # Determine following state and follower count
        is_following = False
        follower_count = 0
        for u in users:
            flist = u.get("following", [])
            if target.get("id") in flist:
                follower_count += 1
                if user and u.get("id") == user.get("id"):
                    is_following = True
        return templates.TemplateResponse(
            "profile.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "profile": target,
                "posts": annotated_posts,
                "is_following": is_following,
                "follower_count": follower_count,
                "is_blocked": bool(user and target.get("id") in user.get("preferences", {}).get("blocked_user_ids", [])),
            },
        )

    @app.post("/user/{username}/follow", response_class=HTMLResponse)
    async def follow_user(
        request: Request,
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
        follow_all_platforms: Optional[str] = Form(None),
    ):
        """Follow another user (if not already) and notify them."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        target: Optional[dict] = None
        for u in users:
            if u.get("username") == username:
                target = u
                break
        if not target:
            return Response(content="User not found", status_code=404)
        if target.get("id") in user.get("preferences", {}).get("blocked_user_ids", []):
            return Response(content="Unblock this user before following.", status_code=400)
        if user.get("id") in target.get("preferences", {}).get("blocked_user_ids", []):
            return Response(content="You cannot follow this user.", status_code=403)
        if user.get("id") == target.get("id"):
            return RedirectResponse(url=f"/user/{username}", status_code=303)
        # Update following list
        updated = False
        for u in users:
            if u.get("id") == user.get("id"):
                flist = u.setdefault("following", [])
                if target.get("id") not in flist:
                    flist.append(target.get("id"))
                    user["following"] = flist
                    updated = True
                break
        if updated:
            save_users(users)
            # Notification for target
            notif = {
                "platform": "mesh",
                "content": f"{user['username']} followed you",
                "timestamp": datetime.utcnow().isoformat(),
            }
            for u in users:
                if u.get("id") == target.get("id"):
                    u.setdefault("notifications", []).append(notif)
                    break
            if follow_all_platforms is not None:
                record_sync_event(
                    users,
                    user["id"],
                    "mesh",
                    "follow_all_platforms",
                    f"followed {target.get('username')} across linked platforms",
                )
                enqueue_sync_job(
                    actor_id=user["id"],
                    platform="mesh",
                    action="follow_all_platforms",
                    reference=f"followed {target.get('username')}",
                    target_id=target.get("id"),
                )
            save_users(users)
        return RedirectResponse(url=f"/user/{username}", status_code=303)

    @app.post("/user/{username}/block", response_class=HTMLResponse)
    async def block_user(
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Block another user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        target = next((u for u in users if u.get("username") == username), None)
        if not target:
            return Response(content="User not found", status_code=404)
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                blocked = prefs.setdefault("blocked_user_ids", [])
                if target.get("id") not in blocked and target.get("id") != user.get("id"):
                    blocked.append(target.get("id"))
                # also unfollow automatically
                following = u.setdefault("following", [])
                if target.get("id") in following:
                    following.remove(target.get("id"))
                user["preferences"]["blocked_user_ids"] = blocked
                user["following"] = following
                break
        save_users(users)
        log_security_event(user.get("id"), "user_blocked", f"blocked {username}", "info")
        return RedirectResponse(url=f"/user/{username}", status_code=303)

    @app.post("/user/{username}/unblock", response_class=HTMLResponse)
    async def unblock_user(
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Unblock another user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        target = next((u for u in users if u.get("username") == username), None)
        if not target:
            return Response(content="User not found", status_code=404)
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                blocked = prefs.setdefault("blocked_user_ids", [])
                if target.get("id") in blocked:
                    blocked.remove(target.get("id"))
                user["preferences"]["blocked_user_ids"] = blocked
                break
        save_users(users)
        log_security_event(user.get("id"), "user_unblocked", f"unblocked {username}", "info")
        return RedirectResponse(url=f"/user/{username}", status_code=303)

    @app.post("/user/{username}/unfollow", response_class=HTMLResponse)
    async def unfollow_user(
        request: Request,
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Unfollow another user if currently followed."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        target: Optional[dict] = None
        for u in users:
            if u.get("username") == username:
                target = u
                break
        if not target:
            return Response(content="User not found", status_code=404)
        if user.get("id") == target.get("id"):
            return RedirectResponse(url=f"/user/{username}", status_code=303)
        # Remove from following list
        updated = False
        for u in users:
            if u.get("id") == user.get("id"):
                flist = u.setdefault("following", [])
                if target.get("id") in flist:
                    flist.remove(target.get("id"))
                    user["following"] = flist
                    updated = True
                break
        if updated:
            save_users(users)
        return RedirectResponse(url=f"/user/{username}", status_code=303)

    @app.get("/messages/send", response_class=HTMLResponse)
    async def message_send_get(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Render a form to send a message to another user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        recipients = [
            u for u in users
            if u.get("id") != user.get("id") and not users_are_blocked(user.get("id"), u.get("id"), users)
        ]
        return templates.TemplateResponse(
            "message_send.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "recipients": recipients,
                "platforms": user.get("preferences", {}).get("connected_platforms", []) or ["mesh"],
            },
        )

    @app.post("/messages/send", response_class=HTMLResponse)
    async def message_send_post(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        recipient_id: int = Form(...),
        message: str = Form(...),
        platform: str = Form("mesh"),
    ):
        """Send a message to a recipient and deliver notifications."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        if is_rate_limited(message_attempts[user.get("id")], max_events=20, window_seconds=60):
            log_security_event(user.get("id"), "message_rate_limited", f"message send rate limit exceeded to {recipient_id}", "warning")
            return Response(content="Too many messages sent. Please slow down.", status_code=429)
        text = clean_text(message, 2000)
        if not text:
            return RedirectResponse(url="/messages/send", status_code=303)
        users = load_users()
        recipient: Optional[dict] = None
        for u in users:
            if u.get("id") == int(recipient_id):
                recipient = u
                break
        if not recipient:
            return Response(content="Recipient not found", status_code=404)
        if users_are_blocked(user.get("id"), recipient.get("id"), users):
            return Response(content="Cannot message this user due to privacy settings.", status_code=403)
        timestamp = datetime.utcnow().isoformat()
        msg_obj = {
            "id": next_message_id(users),
            "sender_id": user.get("id"),
            "receiver_id": recipient.get("id"),
            "message": text,
            "platform": platform.lower(),
            "timestamp": timestamp,
            "delivered_at": timestamp,
            "read_by_receiver": False,
            "read_at": None,
            "reactions": [],
            "reply_to_id": None,
            "attachment_url": "",
            "edited_at": None,
            "deleted": False,
        }
        # Append the message to both sender and recipient histories
        for u in users:
            if u.get("id") == user.get("id") or u.get("id") == recipient.get("id"):
                u.setdefault("messages", []).append(msg_obj)
        # Notification for recipient
        if user.get("id") != recipient.get("id"):
            notif = {
                "platform": platform.lower(),
                "content": f"{user['username']} sent you a message via {platform.lower()}",
                "timestamp": timestamp,
            }
            recipient.setdefault("notifications", []).append(notif)
        record_sync_event(users, user["id"], platform.lower(), "message", f"to {recipient.get('username')}")
        enqueue_sync_job(
            actor_id=user["id"],
            platform=platform.lower(),
            action="message",
            reference=f"to {recipient.get('username')}",
            target_id=recipient.get("id"),
        )
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)

    @app.get("/privacy", response_class=HTMLResponse)
    async def privacy_center_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Render privacy center with export/delete controls."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        requests = sorted(user.get("privacy_requests", []), key=lambda r: r.get("timestamp", ""), reverse=True)
        return templates.TemplateResponse(
            "privacy_center.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "requests": requests,
            },
        )

    @app.post("/privacy/request")
    async def privacy_request_post(
        user: Optional[dict] = Depends(current_user_dep),
        request_type: str = Form(...),
    ):
        """Queue a privacy request (export/delete)."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        allowed = {"export_data", "delete_data"}
        req_type = request_type if request_type in allowed else "export_data"
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                u.setdefault("privacy_requests", []).append(
                    {
                        "type": req_type,
                        "status": "queued",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
                user["privacy_requests"] = u["privacy_requests"]
                break
        save_users(users)
        return RedirectResponse(url="/privacy", status_code=303)

    @app.post("/privacy/delete/confirm")
    async def privacy_delete_confirm(
        request: Request,
        password: str = Form(...),
        confirmation_text: str = Form(""),
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Permanently delete account and associated content after confirmation."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        if confirmation_text.strip().upper() != "DELETE":
            return RedirectResponse(url="/privacy", status_code=303)
        if not verify_password(password, user.get("hashed_password", "")):
            log_security_event(user.get("id"), "delete_attempt_failed_password", "privacy delete password mismatch", "warning")
            return RedirectResponse(url="/privacy", status_code=303)

        users = load_users()
        posts = load_posts()
        deleted_user_id = user.get("id")

        # Remove account from user store and follow graphs.
        updated_users: list[dict] = []
        for u in users:
            if u.get("id") == deleted_user_id:
                continue
            following = [fid for fid in u.get("following", []) if fid != deleted_user_id]
            u["following"] = following
            # purge messaging references to deleted user
            u["messages"] = [
                m
                for m in u.get("messages", [])
                if m.get("sender_id") != deleted_user_id and m.get("receiver_id") != deleted_user_id
            ]
            updated_users.append(u)
        save_users(updated_users)

        # Delete posts authored by user and scrub comments from deleted user.
        remaining_posts: list[dict] = []
        for p in posts:
            if p.get("user_id") == deleted_user_id:
                continue
            p["comments"] = [c for c in p.get("comments", []) if c.get("user_id") != deleted_user_id]
            remaining_posts.append(p)
        save_posts(remaining_posts)

        log_security_event(deleted_user_id, "account_deleted", "user completed permanent delete", "critical")
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie(SESSION_COOKIE_NAME)
        response.delete_cookie(SESSION_ID_COOKIE_NAME)
        response.delete_cookie(CSRF_COOKIE_NAME)
        return response

    @app.get("/privacy/export")
    async def privacy_export(
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Download user export bundle as JSON."""
        if not user:
            return JSONResponse(status_code=401, content={"error": "unauthenticated"})
        posts = load_posts()
        return export_user_bundle(user, posts)

    @app.get("/security-center", response_class=HTMLResponse)
    async def security_center_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Show security-relevant account events and controls."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        events = [e for e in load_audit_log() if e.get("actor_id") in {None, user.get("id")}]
        events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
        sessions = sorted(user.get("sessions", []), key=lambda s: s.get("last_seen_at", ""), reverse=True)
        return templates.TemplateResponse(
            "security_center.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "events": events[:120],
                "sessions": sessions,
            },
        )

    @app.post("/security/sessions/revoke/{sid}")
    async def revoke_session(
        sid: str,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Revoke a specific active session for current user."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                u["sessions"] = [s for s in u.get("sessions", []) if s.get("sid") != sid]
                user["sessions"] = u["sessions"]
                break
        save_users(users)
        log_security_event(user.get("id"), "session_revoked", f"sid={sid[:8]}", "warning")
        return RedirectResponse(url="/security-center", status_code=303)

    @app.post("/security/sessions/revoke-all")
    async def revoke_all_sessions(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Revoke all sessions except current one."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        current_sid = request.cookies.get(SESSION_ID_COOKIE_NAME)
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                u["sessions"] = [s for s in u.get("sessions", []) if s.get("sid") == current_sid]
                user["sessions"] = u["sessions"]
                break
        save_users(users)
        log_security_event(user.get("id"), "sessions_revoked_all", "revoked all except current session", "warning")
        return RedirectResponse(url="/security-center", status_code=303)

    @app.get("/sync-center", response_class=HTMLResponse)
    async def sync_center_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """View queued/completed sync jobs across connected platforms."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        jobs = load_sync_jobs()
        visible = [j for j in jobs if j.get("actor_id") == user.get("id")]
        visible.sort(key=lambda j: j.get("timestamp", ""), reverse=True)
        return templates.TemplateResponse(
            "sync_center.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "jobs": visible[:100],
            },
        )

    @app.post("/sync-center/{job_id}/retry")
    async def sync_job_retry(
        job_id: int,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Retry a failed sync job (simulated integration)."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        jobs = load_sync_jobs()
        for job in jobs:
            if job.get("id") == job_id and job.get("actor_id") == user.get("id"):
                job["attempts"] = int(job.get("attempts", 0)) + 1
                job["status"] = "completed"
                job["last_error"] = ""
                job["completed_at"] = datetime.utcnow().isoformat()
                break
        save_sync_jobs(jobs)
        return RedirectResponse(url="/sync-center", status_code=303)

    @app.get("/api/mesh/graph")
    async def mesh_graph_api(
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Return a JSON graph payload for future front-end/3D renderers."""
        if not user:
            return JSONResponse(status_code=401, content={"error": "unauthenticated"})
        users = load_users()
        posts = load_posts()
        author_ids = [user["id"]] + user.get("following", [])
        visible_posts = [p for p in posts if p.get("user_id") in author_ids]
        nodes = [{"id": f"user:{user['id']}", "type": "user", "label": user.get("username")}]
        edges = []
        for fid in user.get("following", []):
            target = find_user_by_id(fid, users)
            if target:
                nodes.append({"id": f"user:{fid}", "type": "user", "label": target.get("username")})
                edges.append({"source": f"user:{user['id']}", "target": f"user:{fid}", "type": "follows"})
        for p in visible_posts:
            post_node = {"id": f"post:{p.get('id')}", "type": "post", "label": p.get("title", "post")}
            nodes.append(post_node)
            edges.append({"source": f"user:{p.get('user_id')}", "target": post_node["id"], "type": "authored"})
            for tag in p.get("tags", []):
                tag_id = f"tag:{tag}"
                nodes.append({"id": tag_id, "type": "tag", "label": tag})
                edges.append({"source": post_node["id"], "target": tag_id, "type": "tagged"})
        # Dedupe nodes by id
        dedup_nodes = {n["id"]: n for n in nodes}
        return {"nodes": list(dedup_nodes.values()), "edges": edges}


    return app


# Instantiate the application for ASGI servers
app = create_app()

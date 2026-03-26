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
from typing import Optional

from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

import json
from pathlib import Path

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

    app = FastAPI(title="mesh.me", version="0.2.0")
    # Mount static files under /static
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

    # Path to the JSON file that stores users.  Each entry is a dict with
    # ``id``, ``username``, ``email`` and ``hashed_password`` keys.
    user_file = Path(__file__).resolve().parent / "users.json"

    def ensure_user_defaults(u: dict) -> dict:
        """Ensure a loaded user dict has all expected keys for preferences, messages and notifications.

        This helper augments legacy user records created before additional features were added.  It
        populates sensible defaults for preferences (feed layout, notification toggles, connected
        platforms and read receipts) as well as message and notification lists.  Without these
        defaults, template rendering may fail when accessing missing keys."""
        prefs = u.setdefault(
            "preferences",
            {
                "feed_layout": "instagram",
                "notifications_enabled": True,
                "summary_enabled": False,
                "connected_platforms": [],
                "read_receipts": True,
            },
        )
        # Ensure each expected preference exists (to future‑proof against missing keys)
        prefs.setdefault("feed_layout", "instagram")
        prefs.setdefault("notifications_enabled", True)
        prefs.setdefault("summary_enabled", False)
        prefs.setdefault("connected_platforms", [])
        prefs.setdefault("read_receipts", True)
        u.setdefault("messages", [])
        u.setdefault("notifications", [])
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

    def save_users(users: list[dict]) -> None:
        with user_file.open("w", encoding="utf-8") as f:
            json.dump(users, f)

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

    # Dependency to inject current user into routes if available
    def current_user_dep(request: Request) -> Optional[dict]:
        token = request.cookies.get(SESSION_COOKIE_NAME)
        if not token:
            return None
        user_id = decode_session_token(serializer, token)
        if user_id is None:
            return None
        users = load_users()
        return find_user_by_id(user_id, users)

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
        users = load_users()
        user = find_user_by_identifier(identifier.strip(), users)
        if not user or not verify_password(password, user["hashed_password"]):
            # Show an error on the landing page
            context = {"request": request, "minimal": True, "error": "Invalid username/email or password"}
            return templates.TemplateResponse("landing.html", context)
        # Create a signed session token and set it in a cookie
        token = create_session_token(serializer, user["id"])
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(
            SESSION_COOKIE_NAME,
            token,
            httponly=True,
            max_age=60 * 60 * 24 * 7,  # one week
            samesite="lax",
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
        username = username.strip()
        email = email.strip().lower()
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
            },
            "messages": [],
            "notifications": [],
        }
        users.append(new_user)
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
        )
        return response

    @app.get("/dashboard", response_class=HTMLResponse)
    async def dashboard(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Show a simple dashboard or redirect to login if not authenticated."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        return templates.TemplateResponse(
            "dashboard.html",
            {"request": request, "minimal": False, "user": user},
        )

    @app.get("/logout")
    async def logout():
        """Clear the session cookie and redirect to the landing page."""
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie(SESSION_COOKIE_NAME)
        return response

    @app.get("/mesh", response_class=HTMLResponse)
    async def mesh_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display the mesh view – an interactive representation of the user's social graph."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        return templates.TemplateResponse(
            "mesh.html",
            {"request": request, "minimal": False, "user": user},
        )

    @app.get("/feed", response_class=HTMLResponse)
    async def feed_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        layout: str | None = None,
    ):
        """Display the user's custom feed.

        A query parameter ``layout`` allows the user to select a UI style (e.g. instagram, youtube, tiktok).
        """
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Determine layout from query parameter or user preferences; fall back to a sensible default.
        default_layout = user.get("preferences", {}).get("feed_layout", "instagram") if user else "instagram"
        query_layout = request.query_params.get("layout") or layout or default_layout
        # Provide some dummy posts as placeholders
        sample_posts = [
            {"title": "Sample post 1", "content": "This is a placeholder for your unified feed."},
            {"title": "Sample post 2", "content": "In a full implementation, content from various platforms will appear here."},
            {"title": "Sample post 3", "content": "You can like, comment and interact with posts natively."},
        ]
        return templates.TemplateResponse(
            "feed.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "layout": query_layout,
                "posts": sample_posts,
            },
        )

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
        notifications = user.get("notifications", [])
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
            },
        )

    @app.get("/messages", response_class=HTMLResponse)
    async def messages_view(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
    ):
        """Display a unified message view across connected platforms (MeChat)."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        messages = user.get("messages", [])
        # Sort messages chronologically by timestamp if available; fallback to insertion order
        def msg_time_key(m):
            return m.get("timestamp", "")

        messages_sorted = sorted(messages, key=msg_time_key)
        return templates.TemplateResponse(
            "messages.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "messages": messages_sorted,
            },
        )

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
    ):
        """Persist user preference changes from the settings page."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        # Convert checkbox values ("on" or None) to booleans
        notif_on = notifications_enabled is not None
        summary_on = summary_enabled is not None
        read_on = read_receipts is not None
        users = load_users()
        for u in users:
            if u.get("id") == user.get("id"):
                prefs = u.setdefault("preferences", {})
                prefs["feed_layout"] = feed_layout
                prefs["notifications_enabled"] = notif_on
                prefs["summary_enabled"] = summary_on
                prefs["read_receipts"] = read_on
                # update current user context
                user["preferences"] = prefs
                break
        save_users(users)
        return RedirectResponse(url="/settings", status_code=303)

    return app


# Instantiate the application for ASGI servers
app = create_app()
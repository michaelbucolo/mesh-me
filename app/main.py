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

    def load_users() -> list[dict]:
        if user_file.exists():
            try:
                with user_file.open("r", encoding="utf-8") as f:
                    return json.load(f)
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
        new_user = {"id": next_id, "username": username, "email": email, "hashed_password": hashed_password}
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
        # Determine layout from query parameter or default
        query_layout = request.query_params.get("layout") or layout or "instagram"
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

    return app


# Instantiate the application for ASGI servers
app = create_app()

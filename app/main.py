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
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

import json
from pathlib import Path
from datetime import datetime

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
    # ``id``, ``username``, ``email`` and ``hashed_password`` keys, plus
    # optional preferences, messages, notifications and following lists.
    user_file = Path(__file__).resolve().parent / "users.json"

    # Path to the JSON file that stores posts.  Each post record contains an
    # ``id``, ``user_id``, ``title``, ``content``, ``timestamp``, ``likes``
    # (list of user IDs) and ``comments`` (list of comment objects).
    posts_file = Path(__file__).resolve().parent / "posts.json"

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
            },
        )
        # Ensure each expected preference key exists (future‑proofing)
        prefs.setdefault("feed_layout", "instagram")
        prefs.setdefault("notifications_enabled", True)
        prefs.setdefault("summary_enabled", False)
        prefs.setdefault("connected_platforms", [])
        prefs.setdefault("read_receipts", True)
        # Messaging: list of message dicts (sender_id, receiver_id, message, platform, timestamp)
        u.setdefault("messages", [])
        # Notifications: list of notification dicts (platform, content, timestamp)
        u.setdefault("notifications", [])
        # Following: list of user IDs this account follows
        u.setdefault("following", [])
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
                    return data
            except Exception:
                return []
        return []

    def save_posts(posts: list[dict]) -> None:
        """Persist the list of posts to disk."""
        with posts_file.open("w", encoding="utf-8") as f:
            json.dump(posts, f)

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
            platform = m_copy.get("platform", "mesh")
            if sender_name is None and "sender_id" in m_copy:
                sender_name = id_to_user.get(m_copy.get("sender_id"), {}).get("username", "Unknown")
            if platform is None:
                platform = "mesh"
            m_copy["sender"] = sender_name
            m_copy["platform"] = platform
            normalised.append(m_copy)
        # Sort messages chronologically by timestamp (ISO strings compare lexicographically)
        messages_sorted = sorted(normalised, key=lambda m: m.get("timestamp", ""))
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
        # Load posts and users
        all_posts = load_posts()
        all_users = load_users()
        id_to_user: dict[int, dict] = {u["id"]: u for u in all_users}
        # Determine which author IDs should appear in the feed
        author_ids: list[int] = [user["id"]] + user.get("following", [])
        visible_posts = [p for p in all_posts if p.get("user_id") in author_ids]
        # Sort posts newest first (lexicographically works for ISO timestamps)
        visible_posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)
        # Annotate each post
        annotated_posts = []
        for p in visible_posts:
            annotated = p.copy()
            author = id_to_user.get(p.get("user_id"))
            annotated["author"] = author.get("username") if author else "Unknown"
            likes = p.get("likes", [])
            annotated["like_count"] = len(likes)
            annotated["liked"] = user["id"] in likes
            # Annotate comments with author names
            comments: list[dict] = p.get("comments", [])
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
    ):
        """Create a new post for the current user and persist it."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        title = title.strip()
        content = content.strip()
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
        new_post_record = {
            "id": next_id,
            "user_id": user["id"],
            "title": title,
            "content": content,
            "timestamp": timestamp,
            "likes": [],
            "comments": [],
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
        updated = False
        for p in posts:
            if p.get("id") == post_id:
                likes: list[int] = p.setdefault("likes", [])
                if user["id"] in likes:
                    likes.remove(user["id"])
                else:
                    likes.append(user["id"])
                    # Create a notification for the post author (if not self)
                    if user["id"] != p.get("user_id"):
                        author_id = p.get("user_id")
                        users = load_users()
                        for u in users:
                            if u.get("id") == author_id:
                                notif = {
                                    "platform": "mesh",
                                    "content": f"{user['username']} liked your post \"{p['title']}\"",
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
        text = comment.strip()
        if not text:
            return RedirectResponse(url=f"/posts", status_code=303)
        posts = load_posts()
        for p in posts:
            if p.get("id") == post_id:
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
                # Notification for author if commenter is not the same person
                if user["id"] != p.get("user_id"):
                    author_id = p.get("user_id")
                    users = load_users()
                    for u in users:
                        if u.get("id") == author_id:
                            notif = {
                                "platform": "mesh",
                                "content": f"{user['username']} commented on your post \"{p['title']}\"",
                                "timestamp": datetime.utcnow().isoformat(),
                            }
                            u.setdefault("notifications", []).append(notif)
                            break
                    save_users(users)
                break
        save_posts(posts)
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
            },
        )

    @app.post("/user/{username}/follow", response_class=HTMLResponse)
    async def follow_user(
        request: Request,
        username: str,
        user: Optional[dict] = Depends(current_user_dep),
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
            save_users(users)
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
        recipients = [u for u in users if u.get("id") != user.get("id")]
        return templates.TemplateResponse(
            "message_send.html",
            {
                "request": request,
                "minimal": False,
                "user": user,
                "recipients": recipients,
            },
        )

    @app.post("/messages/send", response_class=HTMLResponse)
    async def message_send_post(
        request: Request,
        user: Optional[dict] = Depends(current_user_dep),
        recipient_id: int = Form(...),
        message: str = Form(...),
    ):
        """Send a message to a recipient and deliver notifications."""
        if not user:
            return RedirectResponse(url="/", status_code=303)
        text = message.strip()
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
        timestamp = datetime.utcnow().isoformat()
        msg_obj = {
            "sender_id": user.get("id"),
            "receiver_id": recipient.get("id"),
            "message": text,
            "platform": "mesh",
            "timestamp": timestamp,
        }
        # Append the message to both sender and recipient histories
        for u in users:
            if u.get("id") == user.get("id") or u.get("id") == recipient.get("id"):
                u.setdefault("messages", []).append(msg_obj)
        # Notification for recipient
        if user.get("id") != recipient.get("id"):
            notif = {
                "platform": "mesh",
                "content": f"{user['username']} sent you a message",
                "timestamp": timestamp,
            }
            recipient.setdefault("notifications", []).append(notif)
        save_users(users)
        return RedirectResponse(url="/messages", status_code=303)


    return app


# Instantiate the application for ASGI servers
app = create_app()
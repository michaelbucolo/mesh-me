"""
Authentication utilities for MeshMe.

This module encapsulates password hashing/verification and session token
handling.  It uses PassLib's ``bcrypt`` scheme for secure password
hashing and ``itsdangerous`` to sign session cookies.  To change the
session cookie name or the salt used for signing, adjust the constants
defined below.  The serializer requires a secret key which should be
provided via the application settings.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Request
from itsdangerous import URLSafeSerializer, BadSignature

from passlib.context import CryptContext
# Name of the cookie used to store the session token
SESSION_COOKIE_NAME = "meshme_session"

# Prefer argon2 when available; gracefully fall back to bcrypt in
# environments where ``argon2-cffi`` is not installed.
try:
    from argon2 import PasswordHasher
except Exception:  # pragma: no cover - exercised only when optional dep missing
    PasswordHasher = None

_bcrypt_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ph = PasswordHasher() if PasswordHasher is not None else None


def get_password_hash(password: str) -> str:
    """Hash a plain password for storage using argon2 (or bcrypt fallback)."""
    if _ph is not None:
        return _ph.hash(password)
    return _bcrypt_ctx.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if ``plain_password`` matches ``hashed_password``."""
    try:
        # Passlib-annotated hashes expose the algorithm in prefix (`$2b$`, `$argon2...`).
        if hashed_password.startswith("$2"):
            return _bcrypt_ctx.verify(plain_password, hashed_password)
        if _ph is not None:
            return _ph.verify(hashed_password, plain_password)
        return _bcrypt_ctx.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_serializer(secret_key: str) -> URLSafeSerializer:
    """Create a URLSafeSerializer for session tokens."""
    return URLSafeSerializer(secret_key, salt="meshme-session")


def create_session_token(serializer: URLSafeSerializer, user_id: int) -> str:
    """Return a signed session token for the given user ID."""
    return serializer.dumps(user_id)


def decode_session_token(serializer: URLSafeSerializer, token: str) -> Optional[int]:
    """Decode a session token and return the stored user ID.

    Returns ``None`` if the token is missing or cannot be verified.
    """
    try:
        return serializer.loads(token)
    except BadSignature:
        return None


# Note: user lookup is performed in ``main.py`` where the store
# implementation is known.  ``auth.py`` does not depend on any
# particular persistence layer.

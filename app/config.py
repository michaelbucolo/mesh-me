"""
Configuration settings for MeshMe.

This module defines a simple dataclass for application settings and a helper
function to read values from environment variables.  The secret key is used
to sign session cookies and other tokens.  The base URL can be adjusted
depending on where the app is deployed.  When the development flag
``dev_show_verify_link`` is set, certain debug information (such as
verification links) may be displayed to the user.

If you need to customise additional settings in the future, extend the
``Settings`` dataclass and the ``get_settings`` function accordingly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_bool(name: str, default: bool = False) -> bool:
    """Return a boolean from an environment variable.

    Environment variables are considered true if their stripped lower‑case
    value is one of ``{"1", "true", "yes", "y", "on"}``.  If the variable
    is unset, the provided default is returned instead.
    """
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Settings:
    """Immutable configuration for the application."""

    secret_key: str
    base_url: str
    dev_show_verify_link: bool


def get_settings() -> Settings:
    """Load settings from environment variables with sensible defaults."""
    return Settings(
        secret_key=os.getenv("MESHME_SECRET_KEY", "dev-insecure-secret-change-me"),
        base_url=os.getenv("MESHME_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
        dev_show_verify_link=_env_bool("MESHME_DEV_SHOW_VERIFY_LINK", True),
    )

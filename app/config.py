from __future__ import annotations
import os
from dataclasses import dataclass

def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1","true","yes","y","on"}

@dataclass(frozen=True)
class Settings:
    secret_key: str
    base_url: str
    dev_show_verify_link: bool

def get_settings() -> Settings:
    return Settings(
        secret_key=os.getenv("MESHME_SECRET_KEY","dev-insecure-secret-change-me"),
        base_url=os.getenv("MESHME_BASE_URL","http://127.0.0.1:8000").rstrip("/"),
        dev_show_verify_link=_env_bool("MESHME_DEV_SHOW_VERIFY_LINK", True),
    )

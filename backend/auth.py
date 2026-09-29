import os
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:  # pragma: no cover - dotenv is optional at runtime
    pass

# No default secret. A hardcoded fallback means anyone who reads the source can
# forge tokens for any account, including super_admin, so refuse to start
# without an explicit one.
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    print(
        "[auth] FATAL: JWT_SECRET is missing or shorter than 32 characters.\n"
        "[auth] Generate one with:\n"
        '[auth]   python -c "import secrets; print(secrets.token_urlsafe(48))"\n'
        "[auth] and add it to your .env file.",
        file=sys.stderr,
    )
    raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

bearer_scheme = HTTPBearer(auto_error=False)


# ==================== login rate limiting ====================
# The browser keeps a localStorage counter for UX, but that is trivially cleared
# and means nothing to an attacker hitting the API directly. This is the real
# enforcement point: failed logins are counted per account in this process and
# the account is locked out once the threshold is crossed.
#
# In-memory on purpose: it needs no new datastore and is correct for a single
# API process. Behind multiple workers each has its own counter, so a Redis
# (or Astra-backed) limiter is the next step if this is ever scaled out.

LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "10"))
LOGIN_LOCK_SECONDS = int(os.getenv("LOGIN_LOCK_SECONDS", "900"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))

_lock = threading.Lock()
_login_failures: dict = {}


def _prune(now: float) -> None:
    """Drop entries whose lock/window has elapsed, so the dict cannot grow forever."""
    stale = [key for key, entry in _login_failures.items() if now - entry["last"] > LOGIN_WINDOW_SECONDS]
    for key in stale:
        _login_failures.pop(key, None)


def login_lock_remaining(identifier: str) -> int:
    """Seconds left on the lockout for this account, or 0 when it may try again."""
    now = time.time()
    with _lock:
        _prune(now)
        entry = _login_failures.get(identifier)
        if not entry:
            return 0
        if entry["count"] < LOGIN_MAX_ATTEMPTS:
            return 0
        return max(0, int(entry["locked_until"] - now))


def record_login_failure(identifier: str) -> dict:
    """Count one failed login.

    Returns the resulting state so the caller can tell the user what is left:
    ``{"locked": bool, "retry_after": int, "attempts_remaining": int}``.
    """
    now = time.time()
    with _lock:
        _prune(now)
        entry = _login_failures.setdefault(
            identifier, {"count": 0, "last": now, "locked_until": 0.0}
        )
        # A success is assumed to have cleared it, so a stale run of failures
        # should not immediately re-lock on the next slip.
        if now - entry["last"] > LOGIN_WINDOW_SECONDS:
            entry["count"] = 0
        entry["count"] += 1
        entry["last"] = now
        if entry["count"] >= LOGIN_MAX_ATTEMPTS:
            entry["locked_until"] = now + LOGIN_LOCK_SECONDS
        retry_after = max(0, int(entry["locked_until"] - now))
        return {
            "locked": retry_after > 0,
            "retry_after": retry_after,
            "attempts_remaining": max(0, LOGIN_MAX_ATTEMPTS - entry["count"]),
        }


def clear_login_failures(identifier: str) -> None:
    with _lock:
        _login_failures.pop(identifier, None)


def enforce_login_rate_limit(identifier: str) -> None:
    """Raise 429 when the account is currently locked out."""
    remaining = login_lock_remaining(identifier)
    if remaining:
        minutes = max(1, (remaining + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed sign-in attempts. Try again in {minutes} minute(s).",
            headers={"Retry-After": str(remaining)},
        )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}", headers={"WWW-Authenticate": "Bearer"})

def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Optional[dict]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None

def require_auth(payload: Optional[dict] = Depends(get_current_user_payload)) -> dict:
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    return payload

def require_role(*allowed_roles: str):
    def _checker(payload: dict = Depends(require_auth)):
        role = payload.get("role", "customer")
        # super_admin can access admin routes (Full Super Control)
        effective_allowed = set(allowed_roles)
        if "admin" in effective_allowed and role == "super_admin":
            return payload
        if role not in effective_allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Forbidden: requires {', '.join(allowed_roles)} role")
        return payload
    return _checker

def require_branch_staff(payload: dict = Depends(require_auth)) -> dict:
    """Allow platform owners, branch admins, and branch workers."""
    if payload.get("role") not in {"admin", "worker", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Branch staff access required")
    return payload


def get_tenant_id_from_payload(payload: dict) -> Optional[str]:
    return payload.get("tenant_id")

# Helper to fetch user doc and enrich with tenant name
def enrich_user_with_tenant(user_doc: dict) -> dict:
    tenant_name = None
    tenant_id = user_doc.get("tenant_id")
    if tenant_id:
        try:
            from db import tenants_collection
            # need robust import
        except ImportError:
            from backend.db import tenants_collection
        if tenants_collection is not None:
            try:
                t = tenants_collection.find_one({"tenant_id": tenant_id})
                if t:
                    tenant_name = t.get("name")
                else:
                    # fallback by _id or slug
                    t2 = tenants_collection.find_one({"slug": tenant_id})
                    if t2:
                        tenant_name = t2.get("name")
            except Exception:
                pass
    return tenant_name

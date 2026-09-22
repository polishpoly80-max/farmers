"""
Password hashing utilities using Argon2id (argon2-cffi).

Provides:
- hash_password(password: str) -> str
- verify_password(plain_password: str, hashed_password: str) -> bool
- needs_rehash(hashed_password: str) -> bool

Usage:
    from utils import hash_password, verify_password

    hashed = hash_password("my_secret_password")
    is_valid = verify_password("my_secret_password", hashed)  # True

For FastAPI:
    from utils import hash_password, verify_password
    # on register: doc["password"] = hash_password(plain)
    # on login: if not verify_password(plain, stored_hash): raise 401
"""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash, VerificationError

# Singleton hasher - uses Argon2id by default (recommended)
# Defaults: time_cost=3, memory_cost=65536 (64 MiB), parallelism=4, hash_len=32, salt_len=16
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using Argon2id.

    Args:
        password: Plain-text password to hash. Must be non-empty string.

    Returns:
        str: Argon2 encoded hash string (includes salt, params, version).

    Raises:
        ValueError: If password is empty or not a string.
        RuntimeError: If hashing fails.
    """
    if not isinstance(password, str):
        raise ValueError("password must be a string")
    if not password:
        raise ValueError("password must not be empty")
    try:
        return _ph.hash(password)
    except Exception as e:
        raise RuntimeError(f"Failed to hash password: {e}") from e


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against an Argon2 hash.

    Returns:
        bool: True if matches, False otherwise (including invalid hash).
    """
    if not isinstance(plain_password, str) or not isinstance(hashed_password, str):
        return False
    if not plain_password or not hashed_password:
        return False
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, InvalidHash, VerificationError):
        return False
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    """
    Check if a hash was created with outdated parameters and should be re-hashed.

    On login:
        if verify_password(plain, hashed) and needs_rehash(hashed):
            new_hash = hash_password(plain)
            # update DB
    """
    if not isinstance(hashed_password, str) or not hashed_password:
        return True
    try:
        return _ph.check_needs_rehash(hashed_password)
    except (InvalidHash, VerificationError):
        return True
    except Exception:
        return True


# aliases
hash_pwd = hash_password
verify_pwd = verify_password

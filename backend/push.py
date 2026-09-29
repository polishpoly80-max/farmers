"""
Notification delivery: persistent in-app notifications + Web Push.

Two layers, both driven from one call site (`notify`):
  1. In-app  -> a document in the `notifications` collection, rendered by the
                notification bell in the header. Survives reloads.
  2. Web push -> every browser/device that subscribed for this user, delivered
                through the push service using VAPID-signed payloads.

Web push is entirely optional: if pywebpush is missing, or no VAPID key is
configured, notifications are still recorded in-app and delivery is skipped
instead of raising.
"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

try:
    from db import notifications_collection, push_subscriptions_collection
except ImportError:  # pragma: no cover - when imported as backend.push
    from backend.db import notifications_collection, push_subscriptions_collection  # type: ignore

try:
    from pywebpush import webpush, WebPushException
    PUSH_AVAILABLE = True
except ImportError:  # pragma: no cover
    webpush = None
    WebPushException = Exception
    PUSH_AVAILABLE = False


# ---------------------------------------------------------------- VAPID keys

def _load_env_file() -> None:
    """Load .env from the project root into os.environ (if python-dotenv absent)."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # A stored private key uses literal \n separators; restore them.
            if "\\n" in value:
                value = value.replace("\\n", "\n")
            os.environ.setdefault(key, value)


_load_env_file()

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:info@premiumpoultry.com").strip()
VAPID_TTL = int(os.getenv("VAPID_TTL_SECONDS", "86400") or 86400)

# A PEM private key stored in .env normally carries literal "\n" separators.
# python-dotenv (loaded by app.py before this module) puts that literal form
# straight into os.environ, so the restore in _load_env_file() never runs.
# py_vapid needs real newlines, so normalise here regardless of who loaded it.
if "\\n" in VAPID_PRIVATE_KEY:
    VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.replace("\\n", "\n")


def _vapid_keys_valid() -> bool:
    """A usable key pair is base64url headers with matching EC key length."""
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return False
    if not VAPID_PRIVATE_KEY.lstrip().startswith("-----BEGIN PRIVATE KEY-----"):
        return False
    if "-----END PRIVATE KEY-----" not in VAPID_PRIVATE_KEY:
        return False
    # An EC P-256 private key body is 48 bytes -> 64 base64 chars per line.
    body = [
        line
        for line in VAPID_PRIVATE_KEY.splitlines()
        if line and not line.startswith("-----")
    ]
    return bool(body) and len("".join(body)) > 100


def vapid_ready() -> bool:
    """True when a real browser push can be sent."""
    return bool(PUSH_AVAILABLE and _vapid_keys_valid())


# ------------------------------------------------------- in-app notification

def _insert_in_app(
    user_id: str,
    email: Optional[str],
    title: str,
    body: str,
    notification_type: str,
    branch_id: Optional[str] = None,
    data: Optional[dict] = None,
    audience: str = "user",
) -> Optional[dict]:
    """Write one notification document. Returns the stored doc (sans _id)."""
    if notifications_collection is None:
        return None
    doc = {
        "notification_id": f"NTF-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "email": email,
        "branch_id": branch_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "audience": audience,
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        notifications_collection.insert_one(doc)
    except Exception as exc:  # never let notification delivery break the request
        print(f"[push] failed to store in-app notification: {exc}")
        return None
    doc.pop("_id", None)
    return doc


# --------------------------------------------------------------- web push

def _send_to_subscription(sub: dict, title: str, body: str, url: str, tag: str) -> bool:
    """Send one push message. Returns False if the subscription is now dead."""
    if not vapid_ready():
        return False
    endpoint = sub.get("endpoint")
    if not endpoint:
        return False
    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/",
        "tag": tag,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
    })
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": sub.get("p256dh") or sub.get("keys", {}).get("p256dh"),
                    "auth": sub.get("auth") or sub.get("keys", {}).get("auth"),
                },
            },
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=VAPID_TTL,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc, "response", None)
        code = getattr(status, "status_code", None)
        # 404/410 mean the browser dropped the subscription - clean it up.
        if code in (404, 410):
            _delete_subscription(endpoint)
        else:
            print(f"[push] delivery failed ({code}): {getattr(exc, 'message', exc)}")
        return False
    except Exception as exc:
        print(f"[push] delivery error: {exc}")
        return False


def _delete_subscription(endpoint: str) -> None:
    if push_subscriptions_collection is None:
        return
    try:
        push_subscriptions_collection.delete_many({"endpoint": endpoint})
        print("[push] removed dead subscription")
    except Exception as exc:
        print(f"[push] could not remove dead subscription: {exc}")


def _fan_out_web_push(user_id: str, title: str, body: str, url: str, tag: str) -> int:
    """Push to every device this user subscribed. Returns count delivered."""
    if push_subscriptions_collection is None or not vapid_ready():
        return 0
    try:
        subs = list(push_subscriptions_collection.find({"user_id": user_id}))
    except Exception as exc:
        print(f"[push] could not read subscriptions: {exc}")
        return 0
    delivered = 0
    for sub in subs:
        if _send_to_subscription(sub, title, body, url, tag):
            delivered += 1
    return delivered


# ------------------------------------------------------------- public API

def notify(
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "general",
    email: Optional[str] = None,
    branch_id: Optional[str] = None,
    data: Optional[dict] = None,
    url: str = "/",
    push: bool = True,
) -> dict:
    """Record an in-app notification and (optionally) push it to the user's devices."""
    stored = _insert_in_app(
        user_id=user_id,
        email=email,
        title=title,
        body=body,
        notification_type=notification_type,
        branch_id=branch_id,
        data=data,
    )
    delivered = 0
    if push:
        delivered = _fan_out_web_push(
            user_id, title, body, url, tag=notification_type
        )
    return {
        "stored": stored is not None,
        "pushed": delivered,
        "push_available": vapid_ready(),
        "notification": stored,
    }


def notify_many(
    user_ids: list,
    title: str,
    body: str,
    notification_type: str = "announcement",
    branch_id: Optional[str] = None,
    data: Optional[dict] = None,
    url: str = "/",
    push: bool = True,
) -> dict:
    """Fan a single message out to many users (used for admin broadcasts)."""
    stored_count = 0
    pushed_count = 0
    for uid in user_ids:
        result = notify(
            user_id=uid,
            title=title,
            body=body,
            notification_type=notification_type,
            branch_id=branch_id,
            data=data,
            url=url,
            push=push,
        )
        if result["stored"]:
            stored_count += 1
        pushed_count += result["pushed"]
    return {
        "recipients": len(user_ids),
        "stored": stored_count,
        "pushed": pushed_count,
        "push_available": vapid_ready(),
    }


def save_subscription(
    user_id: str, subscription: dict, user_agent: Optional[str] = None
) -> bool:
    """Persist (or refresh) a browser push subscription for this user."""
    if push_subscriptions_collection is None:
        return False
    endpoint = subscription.get("endpoint")
    if not endpoint:
        return False
    try:
        push_subscriptions_collection.update_one(
            {"endpoint": endpoint},
            {
                "$set": {
                    "user_id": user_id,
                    "endpoint": endpoint,
                    "p256dh": subscription.get("keys", {}).get("p256dh"),
                    "auth": subscription.get("keys", {}).get("auth"),
                    "user_agent": user_agent,
                    "updated_at": datetime.utcnow().isoformat(),
                },
                "$setOnInsert": {"created_at": datetime.utcnow().isoformat()},
            },
            upsert=True,
        )
        return True
    except Exception as exc:
        print(f"[push] could not save subscription: {exc}")
        return False


def remove_subscription(user_id: str, endpoint: str) -> bool:
    if push_subscriptions_collection is None:
        return False
    try:
        result = push_subscriptions_collection.delete_many(
            {"user_id": user_id, "endpoint": endpoint}
        )
        return result.deleted_count > 0
    except Exception as exc:
        print(f"[push] could not remove subscription: {exc}")
        return False

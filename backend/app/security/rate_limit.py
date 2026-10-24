import time
from collections import defaultdict, deque
from threading import Lock

from app.config import get_settings

_lock = Lock()
_login_buckets: dict[str, deque[float]] = defaultdict(deque)
_2fa_buckets: dict[str, deque[float]] = defaultdict(deque)


def _allow(buckets: dict[str, deque[float]], key: str, limit: int, window: float = 60.0) -> bool:
    """Return True if allowed, False if rate limited."""
    now = time.time()
    with _lock:
        q = buckets[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


def check_login_rate_limit(ip: str) -> bool:
    settings = get_settings()
    return _allow(_login_buckets, ip, settings.login_rate_limit_per_minute)


def check_2fa_rate_limit(ip: str) -> bool:
    """Separate, stricter bucket for 2FA verification attempts (VPS auth.py)."""
    settings = get_settings()
    # Default to login limit; prefer dedicated setting when present.
    limit = getattr(settings, "twofa_rate_limit_per_minute", None) or min(
        10, settings.login_rate_limit_per_minute
    )
    return _allow(_2fa_buckets, f"2fa:{ip}", int(limit))

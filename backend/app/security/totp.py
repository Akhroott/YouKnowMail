import base64
import hashlib
import hmac

import pyotp

from app.config import get_settings


def _xor_key() -> bytes:
    settings = get_settings()
    material = (settings.totp_encryption_key or "yoyknowmail-dev-only-not-for-prod").encode()
    return hashlib.sha256(material).digest()


def encrypt_secret(secret: str) -> str:
    key = _xor_key()
    raw = secret.encode("utf-8")
    xored = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
    return base64.urlsafe_b64encode(xored).decode("ascii")


def decrypt_secret(blob: str) -> str:
    key = _xor_key()
    raw = base64.urlsafe_b64decode(blob.encode("ascii"))
    plain = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
    return plain.decode("utf-8")


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="YoyKnowMail")


def verify_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return bool(totp.verify(code.strip(), valid_window=1))


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)

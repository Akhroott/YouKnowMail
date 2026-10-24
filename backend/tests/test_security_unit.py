from app.security.passwords import hash_password, verify_password
from app.security.tokens import hash_token, new_token
from app.security.totp import generate_secret, verify_code
from app.services.serializers import extract_otp


def test_password_hash_roundtrip():
    h = hash_password("SuperSecret1")
    assert verify_password(h, "SuperSecret1")
    assert not verify_password(h, "wrong")


def test_token_hash_stable():
    t = new_token()
    assert hash_token(t) == hash_token(t)
    assert hash_token(t) != hash_token(new_token())


def test_totp_verify():
    import pyotp

    secret = generate_secret()
    code = pyotp.TOTP(secret).now()
    assert verify_code(secret, code)


def test_otp_extraction_confident():
    code = extract_otp(
        "Your verification code",
        "Your verification code is 847291.",
        "<p>Your verification code is <b>847291</b></p>",
    )
    assert code == "847291"


def test_otp_extraction_rejects_years():
    assert extract_otp("Hello", "Welcome to 2024.", "") is None

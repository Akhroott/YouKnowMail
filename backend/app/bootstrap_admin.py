"""Create the first administrator without hardcoded credentials.

Usage:
  set BOOTSTRAP_ADMIN_PASSWORD=...
  python -m app.bootstrap_admin --email admin@yoyknowmail.com --name "Platform Admin"
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from psycopg import connect

from app.config import get_settings
from app.security.passwords import hash_password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Platform Admin")
    args = parser.parse_args(argv)

    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Admin password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match", file=sys.stderr)
            return 1
    if len(password) < 10:
        print("Password must be at least 10 characters", file=sys.stderr)
        return 1

    settings = get_settings()
    with connect(settings.database_url) as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"
        ).fetchone()
        if existing:
            print("An admin already exists. Refusing to bootstrap.", file=sys.stderr)
            return 2
        conn.execute(
            """
            INSERT INTO users (email, password_hash, role, status, display_name)
            VALUES (%s, %s, 'admin', 'active', %s)
            """,
            (args.email.lower(), hash_password(password), args.name),
        )
        conn.commit()
        print(f"Admin created: {args.email.lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import unittest
from pathlib import Path
from datetime import datetime, timedelta
import json

from fastapi.testclient import TestClient

from app.auth import get_password_hash, verify_password
from app.main import create_app


class AuthTests(unittest.TestCase):
    def test_password_roundtrip(self):
        raw = "super-secure-password"
        hashed = get_password_hash(raw)
        self.assertNotEqual(raw, hashed)
        self.assertTrue(verify_password(raw, hashed))
        self.assertFalse(verify_password("wrong-password", hashed))


class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(create_app())

    def test_landing_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("mesh", response.text.lower())
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")
        self.assertIn("default-src 'self'", response.headers.get("content-security-policy", ""))

    def test_protected_routes_redirect_when_logged_out(self):
        for route in ["/dashboard", "/feed", "/mesh", "/discover", "/privacy", "/groups", "/sync-center", "/security-center", "/messages/thread/test", "/messages/group/1"]:
            response = self.client.get(route, follow_redirects=False)
            self.assertEqual(response.status_code, 303)
            self.assertEqual(response.headers.get("location"), "/")

    def test_privacy_export_requires_auth(self):
        response = self.client.get("/privacy/export")
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_mechat_thread_post_requires_auth(self):
        response = self.client.post("/messages/thread/test", data={"message": "hi"}, follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers.get("location"), "/")

    def test_privacy_delete_requires_auth(self):
        response = self.client.post(
            "/privacy/delete/confirm",
            data={"confirmation_text": "DELETE", "password": "irrelevant"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers.get("location"), "/")


class PrivacyAndSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.user_file = Path("app/users.json")
        cls.backup = cls.user_file.read_text(encoding="utf-8") if cls.user_file.exists() else None

    @classmethod
    def tearDownClass(cls):
        if cls.backup is None:
            if cls.user_file.exists():
                cls.user_file.unlink()
        else:
            cls.user_file.write_text(cls.backup, encoding="utf-8")

    def setUp(self):
        if self.user_file.exists():
            self.user_file.unlink()
        self.client_alice = TestClient(create_app(), base_url="https://testserver")
        self.client_bob = TestClient(create_app(), base_url="https://testserver")

    def _signup(self, client: TestClient, username: str, email: str):
        response = client.post(
            "/signup",
            data={"username": username, "email": email, "password": "very-secure-password"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 303)

    def test_blocked_users_cannot_message_each_other(self):
        self._signup(self.client_alice, "alice", "alice@example.com")
        self._signup(self.client_bob, "bob", "bob@example.com")
        alice_csrf = self.client_alice.cookies.get("meshme_csrf")
        bob_csrf = self.client_bob.cookies.get("meshme_csrf")
        self.assertIsNotNone(alice_csrf)
        self.assertIsNotNone(bob_csrf)
        block_response = self.client_alice.post(
            "/user/bob/block",
            data={"csrf_token": alice_csrf},
            follow_redirects=False,
        )
        self.assertEqual(block_response.status_code, 303)
        denied_response = self.client_bob.post(
            "/messages/thread/alice",
            data={"message": "hello", "csrf_token": bob_csrf},
            follow_redirects=False,
        )
        self.assertEqual(denied_response.status_code, 403)
        self.assertIn("privacy settings", denied_response.text.lower())

    def test_stale_session_is_rejected(self):
        self._signup(self.client_alice, "alice", "alice@example.com")
        users = json.loads(self.user_file.read_text(encoding="utf-8"))
        stale_time = (datetime.utcnow() - timedelta(hours=30)).isoformat()
        for user in users:
            if user.get("username") == "alice":
                for session in user.get("sessions", []):
                    session["last_seen_at"] = stale_time
                break
        self.user_file.write_text(json.dumps(users), encoding="utf-8")
        response = self.client_alice.get("/dashboard", follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers.get("location"), "/")

    def test_authenticated_post_requires_csrf_token(self):
        self._signup(self.client_alice, "alice", "alice@example.com")
        self._signup(self.client_bob, "bob", "bob@example.com")
        response = self.client_alice.post("/user/bob/block", follow_redirects=False)
        self.assertEqual(response.status_code, 403)
        self.assertIn("csrf", response.text.lower())

    def test_message_rate_limit_blocks_spam(self):
        self._signup(self.client_alice, "alice", "alice@example.com")
        self._signup(self.client_bob, "bob", "bob@example.com")
        alice_csrf = self.client_alice.cookies.get("meshme_csrf")
        for i in range(20):
            response = self.client_alice.post(
                "/messages/send",
                data={
                    "recipient_id": 2,
                    "message": f"hello-{i}",
                    "platform": "mesh",
                    "csrf_token": alice_csrf,
                },
                follow_redirects=False,
            )
            self.assertEqual(response.status_code, 303)
        blocked = self.client_alice.post(
            "/messages/send",
            data={
                "recipient_id": 2,
                "message": "hello-rate-limit",
                "platform": "mesh",
                "csrf_token": alice_csrf,
            },
            follow_redirects=False,
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("too many messages", blocked.text.lower())


if __name__ == "__main__":
    unittest.main()

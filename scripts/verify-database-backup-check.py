#!/usr/bin/env python3
"""Local-only failure and timestamp tests for the recovery artifact verifier."""

from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import stat
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location("backup_verifier", Path(__file__).with_name("verify-database-backup.py"))
VERIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFIER)


class BackupVerifierTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="mesh-recovery-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "source.db"
        self.restore = self.root / "restore.db"
        self.report = self.root / "report.json"
        with closing(sqlite3.connect(self.source)) as connection:
            connection.executescript('''
                CREATE TABLE "User" (id TEXT PRIMARY KEY);
                CREATE TABLE "Post" (id TEXT PRIMARY KEY, createdAt, isRepost INTEGER NOT NULL, authorId TEXT REFERENCES "User"(id), content TEXT);
                INSERT INTO "User" VALUES ('fixture');
            ''')

    def post(self, identity, date, repost=0, author="fixture"):
        with closing(sqlite3.connect(self.source)) as connection:
            connection.execute('INSERT INTO "Post" VALUES (?, ?, ?, ?, ?)', (identity, date, repost, author, "PRIVATE CONTENT MUST NOT APPEAR"))
            connection.commit()

    def test_mixed_dates_restore_without_touching_source_or_exporting_content(self):
        self.post("text-first", "2024-01-01 00:00:00", 1)
        self.post("numeric-later", 1735689600000)
        self.post("original", "2024-01-01T01:00:00.123+00:00")
        before = self.source.read_bytes()
        result = VERIFIER.verify(self.source, self.restore, self.report)
        self.assertEqual(result["earliestRemainingNativePost"]["id"], "text-first")
        self.assertEqual(result["earliestRemainingNativePost"]["createdAtRaw"], "2024-01-01 00:00:00")
        self.assertEqual(result["earliestRemainingNativePost"]["createdAtUtc"], "2024-01-01T00:00:00.000Z")
        self.assertEqual(result["earliestRemainingOriginalNativePost"]["id"], "original")
        self.assertEqual(self.source.read_bytes(), before)
        self.assertEqual(json.loads(self.report.read_text()), result)
        self.assertNotIn("PRIVATE CONTENT", self.report.read_text())
        self.assertEqual(stat.S_IMODE(self.restore.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.report.stat().st_mode), 0o600)

    def test_existing_outputs_are_never_overwritten(self):
        self.restore.write_text("KEEP")
        with self.assertRaises(VERIFIER.VerificationError):
            VERIFIER.verify(self.source, self.restore, self.report)
        self.assertEqual(self.restore.read_text(), "KEEP")
        self.assertFalse(self.report.exists())

    def test_dangling_output_symlink_is_rejected(self):
        missing = self.root / "must-not-be-created"
        self.report.symlink_to(missing)
        with self.assertRaises(VERIFIER.VerificationError):
            VERIFIER.verify(self.source, self.restore, self.report)
        self.assertFalse(missing.exists())
        self.assertFalse(self.restore.exists())

    def test_invalid_date_cannot_silently_hide_an_earlier_post(self):
        self.post("invalid", "not-a-date")
        self.post("valid", 1735689600000)
        with self.assertRaises(VERIFIER.VerificationError):
            VERIFIER.verify(self.source, self.restore, self.report)
        self.assertFalse(self.restore.exists())
        self.assertFalse(self.report.exists())

    def test_foreign_key_violation_blocks_restore_certification(self):
        self.post("orphan", 1735689600000, author="missing")
        with self.assertRaises(VERIFIER.VerificationError):
            VERIFIER.verify(self.source, self.restore, self.report)
        self.assertFalse(self.report.exists())

    def test_wal_sidecar_refuses_a_potentially_live_input(self):
        Path(str(self.source) + "-wal").touch()
        with self.assertRaises(VERIFIER.VerificationError):
            VERIFIER.verify(self.source, self.restore, self.report)

    def test_empty_snapshot_does_not_claim_a_first_post(self):
        result = VERIFIER.verify(self.source, self.restore, self.report)
        self.assertFalse(result["earliestPostPreserved"])
        self.assertIsNone(result["earliestRemainingNativePost"])

    def test_content_digest_detects_changes_with_unchanged_counts(self):
        self.post("original", 1735689600000)
        result = VERIFIER.verify(self.source, self.restore, self.report)
        with closing(sqlite3.connect(self.restore)) as connection:
            connection.execute('UPDATE "Post" SET content = ?', ("changed",))
            connection.commit()
            changed = VERIFIER.inspect(connection)
        self.assertEqual(result["tableRowCounts"], changed["tableRowCounts"])
        self.assertNotEqual(result["tableContentSha256"], changed["tableContentSha256"])


if __name__ == "__main__":
    unittest.main()

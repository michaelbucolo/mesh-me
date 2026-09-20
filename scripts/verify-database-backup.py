#!/usr/bin/env python3
"""Verify a closed SQLite backup and restore it to a NEW local file.

No environment files, network, production credentials, migrations, or application
code are used. The report contains metadata and the earliest remaining Post's ID
and timestamp, never post bodies or credential values. It is private operational
evidence and must not be committed. Input must be a quiescent, checkpointed export.
"""

import argparse
from contextlib import closing
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys


class VerificationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def quoted(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def normalized_date(value):
    if isinstance(value, (int, float)):
        require(math.isfinite(value), "A native post timestamp is not finite.")
        # Prisma SQLite stores numeric DateTime values as Unix milliseconds.
        parsed = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(milliseconds=value)
    else:
        require(isinstance(value, str) and re.fullmatch(
            r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?", value
        ), "A native post timestamp has an unsupported format.")
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        # SQLite CURRENT_TIMESTAMP is UTC even though it has no suffix.
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def earliest_posts(connection):
    earliest = None
    original = None
    total = 0
    for post_id, raw_date, storage_type, raw_text, repost in connection.execute(
        'SELECT id, createdAt, typeof(createdAt), CAST(createdAt AS TEXT), isRepost FROM "Post"'
    ):
        require(isinstance(post_id, str) and repost in (0, 1), "A native post has invalid identity or repost metadata.")
        try:
            date = normalized_date(raw_date)
        except (ValueError, OverflowError, TypeError):
            raise VerificationError("A native post timestamp cannot be normalized.") from None
        candidate = (date, post_id, {
            "id": post_id,
            "createdAtRaw": raw_text,
            "storageType": storage_type,
            "createdAtUtc": date.isoformat(timespec="microseconds" if date.microsecond % 1000 else "milliseconds").replace("+00:00", "Z"),
            "isRepost": bool(repost),
        })
        total += 1
        if earliest is None or candidate[:2] < earliest[:2]:
            earliest = candidate
        if not repost and (original is None or candidate[:2] < original[:2]):
            original = candidate
    return {
        "remainingNativePostCount": total,
        "earliestRemainingNativePost": earliest[2] if earliest else None,
        "earliestRemainingOriginalNativePost": original[2] if original else None,
        "scope": "Existing Post rows across every author and visibility, including suspended accounts. Imported platform posts are excluded. Previously deleted history cannot be established from this snapshot.",
    }


def logical_digest(connection, table):
    # Read values only inside this process. The report receives one digest per
    # table, never values or per-record hashes. Explicit storage-type/BINARY
    # ordering makes equal-count content changes detectable after a restore.
    columns = [item[0] for item in connection.execute(f"SELECT * FROM {quoted(table)} LIMIT 0").description]
    ordering = ", ".join(f"typeof({quoted(column)}), {quoted(column)} COLLATE BINARY" for column in columns)
    digest = hashlib.sha256()
    digest.update(json.dumps(columns).encode())
    for row in connection.execute(f"SELECT * FROM {quoted(table)} ORDER BY {ordering}"):
        digest.update(b"row\x00")
        for value in row:
            if value is None:
                kind, payload = b"null", b""
            elif isinstance(value, bytes):
                kind, payload = b"blob", value
            elif isinstance(value, int):
                kind, payload = b"integer", str(value).encode()
            elif isinstance(value, float):
                kind, payload = b"real", value.hex().encode()
            else:
                kind, payload = b"text", value.encode("utf-8")
            digest.update(kind + b"\x00" + len(payload).to_bytes(8, "big") + payload)
    return digest.hexdigest()


def inspect(connection):
    require(connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)], "Database integrity check did not pass.")
    require(connection.execute("PRAGMA foreign_key_check").fetchone() is None, "Database has a foreign-key violation.")
    schema = connection.execute(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    ).fetchall()
    tables = [row[1] for row in schema if row[0] == "table"]
    require("Post" in tables and "User" in tables, "Backup does not contain the required Mesh tables.")
    columns = {row[1] for row in connection.execute('PRAGMA table_info("Post")')}
    require({"id", "createdAt", "isRepost"}.issubset(columns), "Native post preservation columns are missing.")
    counts = {table: connection.execute(f"SELECT COUNT(*) FROM {quoted(table)}").fetchone()[0] for table in tables}
    return {
        "integrity": "ok",
        "foreignKeyViolations": 0,
        "schemaSha256": hashlib.sha256(json.dumps(schema, ensure_ascii=False).encode()).hexdigest(),
        "userVersion": connection.execute("PRAGMA user_version").fetchone()[0],
        "tableRowCounts": counts,
        "tableContentSha256": {table: logical_digest(connection, table) for table in tables},
        **earliest_posts(connection),
    }


def assert_closed_export(path):
    for suffix in ("-wal", "-shm", "-journal"):
        require(not Path(str(path) + suffix).exists(), "Input has SQLite sidecar files; provide a closed, checkpointed export.")


def reserve(path):
    # Exclusive creation also rejects existing files and symlinks, including
    # dangling symlinks. The caller provides an existing protected directory.
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(descriptor)


def verify(source_path, restore_path, report_path):
    source = source_path.resolve(strict=True)
    require(source.is_file(), "Input must be an existing SQLite backup file.")
    # Resolve parent directories, but keep the final filename intact so a
    # dangling final symlink cannot turn into an unintended write destination.
    restore = restore_path.parent.resolve(strict=True) / restore_path.name
    report = report_path.parent.resolve(strict=True) / report_path.name
    require(len({source, restore, report}) == 3, "Input, restore, and report must be distinct paths.")
    require(not os.path.lexists(restore) and not os.path.lexists(report), "Restore and report paths must not already exist.")
    assert_closed_export(source)
    with source.open("rb") as handle:
        require(handle.read(16) == b"SQLite format 3\x00", "Input is not an unencrypted SQLite file.")
    before_digest = file_digest(source)
    created = []
    try:
        with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=10)) as input_db:
            input_db.execute("PRAGMA query_only=ON")
            input_db.execute("BEGIN")
            expected = inspect(input_db)
            reserve(restore)
            created.append(restore)
            reserve(report)
            created.append(report)
            # sqlite3's backup API copies a consistent snapshot into only the
            # newly reserved destination. No SQL dump execution is involved.
            with closing(sqlite3.connect(restore.as_uri() + "?mode=rw", uri=True, timeout=10)) as restored_db:
                input_db.backup(restored_db)
                restored_db.execute("PRAGMA query_only=ON")
                actual = inspect(restored_db)
                require(expected == actual, "Restored metadata does not match the source snapshot.")
            input_db.rollback()
        assert_closed_export(source)
        require(before_digest == file_digest(source), "Input changed during verification; repeat using a closed export.")
        result = {
            "formatVersion": 1,
            "verifiedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "status": "local_restore_verified",
            "sourceSha256": before_digest,
            "restoredSha256": file_digest(restore),
            "earliestPostPreserved": expected["earliestRemainingNativePost"] is not None,
            **actual,
            "limits": "This checks a provided local artifact, not production currency, PITR retention, external media, application startup, or credential decryptability. It does not prove the first-ever post if earlier records were deleted. Keep the matching application encryption keys separately.",
        }
        with report.open("w", encoding="utf-8") as handle:
            json.dump(result, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        return result
    except BaseException:
        # Only files created exclusively by this invocation are removed.
        for path in reversed(created):
            path.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Closed local SQLite backup; never a remote URL")
    parser.add_argument("--restore-to", type=Path, required=True, help="New local file in a protected directory")
    parser.add_argument("--report", type=Path, required=True, help="New private JSON evidence file")
    args = parser.parse_args()
    try:
        result = verify(args.source, args.restore_to, args.report)
    except VerificationError as error:
        print(f"Backup verification failed: {error}", file=sys.stderr)
        return 1
    except (OSError, sqlite3.Error):
        # Upstream errors can include paths, SQL, or database values.
        print("Backup verification failed: input, output, or SQLite operation unavailable. No existing output was overwritten.", file=sys.stderr)
        return 1
    print("Local restore verified. Private timestamp evidence saved to the requested report.")
    if not result["earliestPostPreserved"]:
        print("No remaining native post exists; the first-post timestamp was not established.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

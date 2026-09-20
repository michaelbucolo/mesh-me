# Verify a recovery artifact and preserve post history

The local verifier checks a supplied SQLite backup and restores it into a **new** file. It never contacts production, reads environment credentials, starts the application, or runs migrations. A successful check does not establish that production backups are current or that a cloud recovery drill has succeeded.

Use a closed, checkpointed SQLite export from an authorized backup operation. Keep the artifact and outputs outside the repository in a restricted directory on encrypted storage. A full production export contains other people's records and saved credentials; confirm its authorized scope and protected destination before exporting. A timestamp-only preservation request does not require a full export.

```sh
python3 scripts/verify-database-backup.py \
  --source /protected/mesh/snapshot.db \
  --restore-to /protected/mesh/restored-new.db \
  --report /protected/mesh/verification-new.json
```

Both output paths must be unused. They are created with mode `0600`; the parent directory must already exist and be protected. Existing files and final symlinks are rejected. Inputs with WAL, shared-memory, or journal sidecars are rejected because an actively changing database is not a closed backup artifact.

The script checks:

- SQLite integrity and foreign-key consistency before and after restoration.
- Schema digest, all noninternal table counts, and deterministic content digests for every table. Credentials and post bodies are processed only inside the local verifier and never printed or placed in its JSON report.
- The earliest **remaining** native `Post` timestamp, including every author, visibility, and suspended account. The report separately identifies the earliest original native post excluding reposts.
- Mixed Prisma numeric Unix-millisecond timestamps and SQLite/ISO text timestamps. Raw storage value/type and normalized UTC are preserved. Any unsupported timestamp blocks certification instead of being silently skipped.
- Unchanged source-file digest and exclusive output creation.

The JSON report is private operational evidence: it includes table counts, digests, and post IDs/timestamps. Do not commit it. An empty native-post table is reported explicitly and cannot establish a first-post timestamp. Imported platform history is excluded; a platform's old publication date does not establish when a native Mesh post was created. Previously deleted posts require earlier backups or other historical evidence.

Run the isolated safety checks without production access:

```sh
python3 scripts/verify-database-backup-check.py
```

## Obtain and restore the source safely

[Turso point-in-time recovery](https://docs.turso.tech/features/point-in-time-recovery) creates a separate database. Inspect that untouched recovery copy before any application startup: this repository's build and development commands run `scripts/ensure-schema.mjs`, which can change data.

[Turso's export command](https://docs.turso.tech/cli/db/export) can omit recent WAL changes; synchronize the exported file using the supported SDK before asserting currency. The [documented SQL dump endpoint and format](https://docs.turso.tech/sdk/http/reference) are another export route. Restore a known provider dump only into a new isolated database, with no outbound application integrations, using the provider's documented import workflow or a constrained local SQLite importer. Do not execute an arbitrary downloaded SQL file against production. The verifier above accepts a SQLite file, not a SQL script, and never executes dump statements.

For a local conversion, create the destination exclusively, restrict its permissions, disable extension loading, and reject dump operations that attach other files or change filesystem paths. Verify a complete successful transaction, then close/checkpoint the result before passing it to this verifier. Reject unsupported libSQL extensions instead of stripping statements and calling the result complete.

Keep application encryption keys in separate protected storage. A backup containing `enc:v1:` payloads does not establish that those payloads can be decrypted. Preserve the matching historical keys and verify decryptability without printing plaintext before any key replacement or reconnection that could overwrite old credentials. Rotating Turso's SQL access token is a separate operation and cannot recover application ciphertext.

After artifact verification, test application flows on a disposable copy with outbound access blocked except the isolated database and controlled test services. Record recovery time, checkpoint, artifact digest, and drill results before marking production recovery complete.

# Minni Database Backup Procedure

## Active database location

- `<ACTIVE_DB_DIR>/minni.db`

## Backup location

- `<BACKUP_DIR>/minni.db`
- `<BACKUP_DIR>/minni.db-wal`
- `<BACKUP_DIR>/prev/minni.db`
- `<BACKUP_DIR>/prev/minni.db-wal`

## Important

Minni may use WAL mode.

A valid backup should include every existing database file:

- `minni.db`
- `minni.db-wal`
- `minni.db-shm` _(if present)_

Backing up only `minni.db` may miss recent changes still stored in the WAL file.

## Backup steps

1. Fully close OpenCode.
2. Check which Minni DB files currently exist in `<ACTIVE_DB_DIR>`:
   - `minni.db`
   - `minni.db-wal`
   - `minni.db-shm` _(if present)_
3. Copy the current backup in `<BACKUP_DIR>` into `<BACKUP_DIR>/prev/` if you want to preserve the previous snapshot.
4. Copy all current Minni DB files from `<ACTIVE_DB_DIR>` into `<BACKUP_DIR>`.

## Restore steps

1. Fully close OpenCode.
2. Replace the current Minni DB files in `<ACTIVE_DB_DIR>` with the files from `<BACKUP_DIR>`.
3. If the backup includes `minni.db-wal` or `minni.db-shm`, restore those too.
4. Reopen OpenCode and verify that Minni starts correctly.

## Verification

After backup or restore, verify:

- the expected files exist
- file sizes are not zero
- Minni starts normally
- the viewer loads correctly
- the expected data is present

## Notes

- Never modify or replace the database while OpenCode is running.
- Always create a fresh backup before running new schema migrations.
- Restore is a full replacement operation, not a merge.

## Migration rules

- All schema changes must go through Drizzle migrations only.
- Do not edit the database schema manually.
- Do not patch SQLite schema state directly as a shortcut.
- Keep migration work reproducible from versioned code, not from ad-hoc local steps.

#!/usr/bin/env bash
set -euo pipefail
umask 077

DATA_DIR="${LEADGEN_LOCAL_DATA_DIR:-/var/lib/leadgen-client}"
BACKUP_DIR="${LEADGEN_BACKUP_DIR:-/var/backups/leadgen-client}"

case "$DATA_DIR" in ""|"/"|"/var"|"/var/lib") echo "Unsafe data directory" >&2; exit 1;; esac
case "$BACKUP_DIR" in ""|"/"|"/var"|"/var/backups") echo "Unsafe backup directory" >&2; exit 1;; esac

install -d -m 700 "$BACKUP_DIR"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "Data directory does not exist: $DATA_DIR" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/leadgen-client-$STAMP.tar.gz"
tar -C "$(dirname "$DATA_DIR")" -czf "$TARGET" "$(basename "$DATA_DIR")"
chmod 600 "$TARGET"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'leadgen-client-*.tar.gz' -mtime +14 -delete
echo "$TARGET"

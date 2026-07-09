#!/usr/bin/env bash
# Backup PostgreSQL
# Chạy: bash deploy/scripts/backup-db.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/nhatom/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/nhatom_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

docker exec nhatom-postgres pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-nhatom}" > "$FILE"

echo "Đã backup: $FILE"

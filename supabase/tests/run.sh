#!/usr/bin/env bash
# Tests the migration + Row Level Security on a plain local PostgreSQL (no Supabase needed).
# Usage: DATABASE_URL=postgres://postgres@localhost/postgres npm run test:db
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB="${DATABASE_URL:-postgres://postgres@localhost/postgres}"
psql "$DB" -q -v ON_ERROR_STOP=1 -c "drop database if exists smart_expense_test" -c "create database smart_expense_test"
TEST_DB="${DB%/*}/smart_expense_test"
psql "$TEST_DB" -q -v ON_ERROR_STOP=1 -f "$DIR/supabase_stub.sql" -f "$DIR/../migrations/0001_init.sql" -f "$DIR/../migrations/0002_import_key.sql" -f "$DIR/../migrations/0003_grants.sql" -f "$DIR/../migrations/0004_office_categories.sql" -f "$DIR/rls_test.sql"

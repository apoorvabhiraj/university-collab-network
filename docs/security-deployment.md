# Security Deployment Guide

## Environment variables (apps/api/.env)

| Variable | Required | Notes |
|---|---|---|
| DATABASE_URL | YES | PostgreSQL connection string; use a strong password; never commit |
| JWT_ACCESS_SECRET | YES | ≥32 random chars; NEVER use the dev placeholder in production |
| JWT_REFRESH_SECRET | YES | ≥32 random chars, distinct from access secret |
| JWT_ACCESS_TTL | YES | e.g. 15m |
| JWT_REFRESH_TTL | YES | e.g. 7d |
| CORS_ALLOWED_ORIGINS | PROD | Comma-separated explicit origins; defaults to localhost in dev |
| EMAIL_PROVIDER_API_KEY | YES (verification) | Provider key; set via secrets manager |
| NODE_ENV | YES | "production" enables: Secure cookies, test-route gating, JWT strength guard |

## Database

1. Run migrations: `npx prisma migrate deploy`
2. Restrict PostgreSQL to localhost/VPC — never public internet
3. Use TLS in the connection string for remote databases
4. Back up before destructive migrations; review migration SQL before deploy

## PostgreSQL restart procedure (this machine)

PostgreSQL data lives in `/home/noah-love/pgdata` (postgres-owned). After a reboot,
the `/run/postgresql` tmpfs dir is lost, causing `pg_ctl` FATAL lock-file errors:

```bash
sudo mkdir -p /run/postgresql
sudo chown postgres:postgres /run/postgresql
sudo -u postgres /usr/bin/pg_ctl -D /home/noah-love/pgdata -l /home/noah-love/pgdata/logfile start
```

## Secret rotation (if compromised)

1. Generate new JWT secrets (32+ random chars): `openssl rand -base64 48`
2. Update `.env` / secrets manager
3. Restart the API (invalidates all access tokens immediately)
4. Refresh tokens in the DB remain valid unless also rotated — rotate by
   deleting all rows in `refresh_tokens` if account-level revocation is needed:
   `DELETE FROM refresh_tokens WHERE user_id = '<compromised-id>';`
5. Force password reset for affected accounts via admin verification flow

## Incident response (quick reference)

1. **Suspected compromise**: check API logs for repeated 401s, unexpected role changes, unusual admin access
2. **Revoke sessions**: delete the user's `refresh_tokens` rows (kills refresh); access tokens expire in ≤15m
3. **Disable account**: `UPDATE users SET status = 'suspended' WHERE id = '<id>';` (requireAuth + login both check)
4. **Preserve evidence**: copy logs before rotation; don't delete rows — mark and retain
5. **Recover**: restore from verified backup only if data corruption is confirmed

# Railway Database Management

PostgreSQL database operations on Railway.

## Connection

```bash
# Via Railway CLI
railway run psql $DATABASE_URL

# Connection string format
postgresql://user:pass@host:5432/railway
```

## Backup

### Automatic Backups

Railway automatically backs up PostgreSQL:
- Frequency: Daily
- Retention: 7 days (free), longer for paid
- Access: Dashboard → PostgreSQL → Backups

### Manual Backup

```bash
# Backup database
railway run pg_dump > backup-$(date +%Y%m%d).sql

# Compressed backup
railway run pg_dump | gzip > backup-$(date +%Y%m%d).sql.gz

# Custom format (recommended)
railway run pg_dump -Fc > backup-$(date +%Y%m%d).dump
```

## Restore

```bash
# Stop application
railway scale web=0

# Restore from SQL
railway run psql $DATABASE_URL < backup.sql

# Restore from custom format
railway run pg_restore -d $DATABASE_URL backup.dump

# Restart application
railway scale web=1
```

## Migrations

```bash
# Run migrations
railway run npm run migrate

# Or manually
railway run psql $DATABASE_URL < migrations/001-initial.sql
```

## Monitoring

```bash
# Database size
railway run psql $DATABASE_URL -c "\
  SELECT pg_size_pretty(pg_database_size(current_database()));"

# Active connections
railway run psql $DATABASE_URL -c "\
  SELECT count(*) FROM pg_stat_activity;"

# Slow queries
railway run psql $DATABASE_URL -c "\
  SELECT query, mean_exec_time \
  FROM pg_stat_statements \
  ORDER BY mean_exec_time DESC \
  LIMIT 10;"
```

---

**Last Updated:** December 2024

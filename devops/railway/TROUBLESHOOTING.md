# Railway Troubleshooting

Common issues and solutions.

## Deployment Failures

**Issue: Build fails**
```bash
# Check logs
railway logs --deployment latest

# Common causes:
# - Missing dependencies
# - Node version mismatch
# - Build script errors

# Solution: Fix locally first
npm ci && npm run build && npm test
```

**Issue: Service crashes**
```bash
# Check logs
railway logs | grep -i error

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Port binding issue

# Solution: Verify environment
railway variables
```

## Database Issues

**Issue: Cannot connect**
```bash
# Test connection
railway run psql $DATABASE_URL -c "SELECT 1;"

# Check DATABASE_URL
railway variables | grep DATABASE_URL

# Solution: Restart PostgreSQL
# Dashboard → PostgreSQL → Restart
```

**Issue: Slow queries**
```bash
# Find slow queries
railway run psql $DATABASE_URL -c "\
  SELECT query, mean_exec_time \
  FROM pg_stat_statements \
  ORDER BY mean_exec_time DESC \
  LIMIT 5;"

# Solution: Add indexes, optimize queries
```

## Performance Issues

**Issue: High memory usage**
```bash
# Check metrics
railway status

# Solution: Increase memory
# Dashboard → Service → Settings → Resources
```

**Issue: Slow response times**
```bash
# Test response time
time curl https://kars.jvhlabs.com/api/health

# Solution:
# - Scale horizontally
# - Optimize database queries
# - Enable caching
```

## Getting Help

- Railway Discord: https://discord.gg/railway
- Documentation: https://docs.railway.app
- Status: https://status.railway.app

---

**Last Updated:** December 2024

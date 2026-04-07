# API Deployment

## Required Environment Variables

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=4000`
- `API_PREFIX=api/v1`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL` or `CORS_ORIGINS`

## Optional Environment Variables

- `APP_NAME`
- `REDIS_URL`
- `TRUST_PROXY`
- `LOG_LEVEL`

## Production Commands

```bash
npm install
npm run prisma:generate -w apps/api
npm run prisma:migrate:deploy -w apps/api
npm run build -w apps/api
npm run start:prod -w apps/api
```

## Health Check

```bash
GET /api/v1/health
```

## Docker Build

```bash
docker build -f apps/api/Dockerfile -t school-erp-api .
docker run --env-file apps/api/.env -p 4000:4000 school-erp-api
```

## Platform Notes

- Render/Railway/VPS: run `npm run prisma:migrate:deploy -w apps/api` before `start:prod`
- Supabase PostgreSQL: use pooled or direct connection string in `DATABASE_URL`
- External Redis: set `REDIS_URL`; if omitted, API still runs without cache

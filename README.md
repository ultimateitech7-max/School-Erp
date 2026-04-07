# School ERP SaaS Starter

Production-minded starter monorepo for a multi-tenant School ERP built with NestJS, Prisma, PostgreSQL, Next.js App Router, and JWT authentication.

## Apps

- `apps/api`: NestJS API with Prisma, JWT auth, school provisioning, users, and module control.
- `apps/web`: Next.js frontend with login flow, protected dashboard shell, and API auth bridge.

## Quick Start

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
npm install
```

3. Create environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

4. Generate Prisma client, run migrations, and seed baseline data:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start both apps:

```bash
npm run dev
```

## Default Seed Credentials

- Super Admin Email: `superadmin@starter.com`
- Super Admin Password: `Admin@123`

## Example Routes

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/profile`
- `POST /api/v1/schools`
- `GET /api/v1/users`
- `POST /api/v1/modules/toggle`
- `GET /api/v1/health`

## Deployment

### Backend

```bash
npm run build -w apps/api
npm run prisma:migrate:deploy -w apps/api
npm run start:prod -w apps/api
```

### Frontend

```bash
npm run build -w apps/web
npm run start:prod -w apps/web
```

### Docker

```bash
npm run docker:infra
npm run docker:app
```

Deployment references:

- [API Deployment](/Users/macbookm1/school%20management/apps/api/README_DEPLOYMENT.md)
- [Web Deployment](/Users/macbookm1/school%20management/apps/web/README_DEPLOYMENT.md)

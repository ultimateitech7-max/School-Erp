# Web Deployment

## Required Environment Variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`

## Production Commands

```bash
npm install
npm run build -w apps/web
npm run start:prod -w apps/web
```

## Docker Build

```bash
docker build \
  -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  -t school-erp-web .

docker run -p 3000:3000 school-erp-web
```

## Platform Notes

- Vercel/Netlify: configure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL`
- Docker/VPS: app listens on `0.0.0.0:3000`
- API URL must point to the deployed NestJS API including `/api/v1`

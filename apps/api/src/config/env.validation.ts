type EnvConfig = Record<string, string | undefined>;

export function validateEnv(config: EnvConfig): EnvConfig {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const allowedNodeEnvs = ['development', 'test', 'production'];
  const allowedLogLevels = ['log', 'error', 'warn', 'debug', 'verbose'];
  const nodeEnv = config.NODE_ENV?.trim() || 'development';
  const corsOrigins = splitCsv(config.CORS_ORIGINS);

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (!allowedNodeEnvs.includes(nodeEnv)) {
    throw new Error('NODE_ENV must be one of development, test, or production.');
  }

  if (config.PORT) {
    const port = Number(config.PORT);

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error('PORT must be a valid port number.');
    }
  }

  if (config.API_PREFIX) {
    const normalizedPrefix = config.API_PREFIX.replace(/^\/+|\/+$/g, '');

    if (!normalizedPrefix) {
      throw new Error('API_PREFIX must contain a valid path segment.');
    }
  }

  if (config.FRONTEND_URL && !isHttpUrl(config.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL must be a valid http/https URL.');
  }

  for (const origin of splitCsv(config.FRONTEND_URLS)) {
    if (!isHttpUrl(origin)) {
      throw new Error(`FRONTEND_URLS contains an invalid origin: ${origin}`);
    }
  }

  for (const origin of corsOrigins) {
    if (!isHttpUrl(origin)) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  if (config.REDIS_URL && !/^rediss?:\/\//i.test(config.REDIS_URL)) {
    throw new Error('REDIS_URL must start with redis:// or rediss://.');
  }

  if (nodeEnv === 'production' && config.JWT_SECRET && config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  if (config.LOG_LEVEL) {
    const configuredLevels = splitCsv(config.LOG_LEVEL);

    if (configuredLevels.some((level) => !allowedLogLevels.includes(level))) {
      throw new Error(
        'LOG_LEVEL must contain comma-separated Nest logger levels.',
      );
    }
  }

  if (
    nodeEnv === 'production' &&
    !config.FRONTEND_URL &&
    splitCsv(config.FRONTEND_URLS).length === 0 &&
    corsOrigins.length === 0
  ) {
    throw new Error(
      'FRONTEND_URL, FRONTEND_URLS, or CORS_ORIGINS must be configured in production.',
    );
  }

  if (config.TRUST_PROXY && !isValidTrustProxy(config.TRUST_PROXY)) {
    throw new Error(
      'TRUST_PROXY must be true, false, a number, or a valid Express trust proxy value.',
    );
  }

  return config;
}

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string) {
  return /^https?:\/\/.+/i.test(value);
}

function isValidTrustProxy(value: string) {
  const normalized = value.trim().toLowerCase();

  if (['true', 'false', 'loopback', 'linklocal', 'uniquelocal'].includes(normalized)) {
    return true;
  }

  return Number.isInteger(Number(normalized));
}

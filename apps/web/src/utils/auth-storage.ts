import type { UserRecord } from './api';

const AUTH_SESSION_KEY = 'school-erp.auth-session';
const ACCESS_TOKEN_KEY = 'accessToken';

export interface AuthSession {
  accessToken: string;
  permissions: string[];
  user: UserRecord;
}

export function storeAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  } catch {
    clearAuthSession();
  }
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  let rawValue: string | null = null;

  try {
    rawValue = localStorage.getItem(AUTH_SESSION_KEY);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    getStoredAuthSession()?.accessToken ??
    getLocalStorageValue(ACCESS_TOKEN_KEY)
  );
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Ignore storage cleanup failures in restricted environments.
  }
}

function getLocalStorageValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

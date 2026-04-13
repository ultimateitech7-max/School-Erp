import type { UserRecord } from './api';

const AUTH_SESSION_KEY = 'school-erp.auth-session';
const ACCESS_TOKEN_KEY = 'accessToken';
const SELECTED_SCHOOL_ID_KEY = 'school-erp.selected-school-id';
const SCHOOL_SCOPE_EVENT = 'school-erp:school-scope-change';

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
    if (session.user.role === 'SUPER_ADMIN') {
      setSelectedSchoolId(session.user.schoolId ?? null);
    } else {
      setSelectedSchoolId(session.user.schoolId);
    }
  } catch {
    clearAuthSession();
  }
}

export function updateStoredSessionPermissions(permissions: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentSession = getStoredAuthSession();

  if (!currentSession) {
    return;
  }

  storeAuthSession({
    ...currentSession,
    permissions,
  });
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
    localStorage.removeItem(SELECTED_SCHOOL_ID_KEY);
    emitSchoolScopeChange();
  } catch {
    // Ignore storage cleanup failures in restricted environments.
  }
}

export function getSelectedSchoolId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return getLocalStorageValue(SELECTED_SCHOOL_ID_KEY);
}

export function setSelectedSchoolId(schoolId: string | null | undefined) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (schoolId) {
      localStorage.setItem(SELECTED_SCHOOL_ID_KEY, schoolId);
    } else {
      localStorage.removeItem(SELECTED_SCHOOL_ID_KEY);
    }

    emitSchoolScopeChange();
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function subscribeToSelectedSchoolId(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SELECTED_SCHOOL_ID_KEY) {
      listener();
    }
  };

  window.addEventListener(SCHOOL_SCOPE_EVENT, listener as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SCHOOL_SCOPE_EVENT, listener as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}

function getLocalStorageValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function emitSchoolScopeChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(SCHOOL_SCOPE_EVENT));
}

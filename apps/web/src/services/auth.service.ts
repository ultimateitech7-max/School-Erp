'use client';

import type { UserRecord } from '@/utils/api';
import { apiFetch } from '@/utils/api';
import { clearAuthSession } from '@/utils/auth-storage';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  permissions: string[];
  user: UserRecord;
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
    });
  },

  async logout(): Promise<void> {
    clearAuthSession();
  },
};

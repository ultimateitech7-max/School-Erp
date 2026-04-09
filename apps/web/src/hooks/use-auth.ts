'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authService, type LoginPayload } from '@/services/auth.service';
import { storeAuthSession } from '@/utils/auth-storage';

export function useAuth() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const login = async (payload: LoginPayload) => {
    setIsPending(true);

    try {
      const response = await authService.login(payload);
      storeAuthSession({
        accessToken: response.accessToken,
        permissions: response.permissions,
        user: response.user,
      });
      router.push(
        response.user.role === 'PARENT'
          ? '/parent'
          : response.user.role === 'STUDENT'
            ? '/student'
            : '/',
      );
      return response;
    } finally {
      setIsPending(false);
    }
  };

  const logout = async () => {
    setIsPending(true);

    try {
      await authService.logout();
      router.push('/login');
    } finally {
      setIsPending(false);
    }
  };

  return {
    login,
    logout,
    isPending,
  };
}

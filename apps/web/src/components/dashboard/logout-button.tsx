'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogoutIcon } from '@/components/ui/icons';

export function LogoutButton() {
  const { logout, isPending } = useAuth();

  return (
    <Button
      onClick={() => void logout()}
      startIcon={<LogoutIcon />}
      type="button"
      variant="ghost"
    >
      {isPending ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}

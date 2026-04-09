'use client';

import { useEffect, useState } from 'react';
import {
  getSelectedSchoolId,
  setSelectedSchoolId,
  subscribeToSelectedSchoolId,
} from '@/utils/auth-storage';

export function useSchoolScope() {
  const [selectedSchoolId, setSelectedSchoolIdState] = useState<string | null>(() =>
    getSelectedSchoolId(),
  );

  useEffect(() => {
    setSelectedSchoolIdState(getSelectedSchoolId());

    return subscribeToSelectedSchoolId(() => {
      setSelectedSchoolIdState(getSelectedSchoolId());
    });
  }, []);

  return {
    selectedSchoolId,
    setSelectedSchoolId,
  };
}

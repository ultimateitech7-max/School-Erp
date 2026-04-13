'use client';

import { useEffect, useState } from 'react';
import type { AuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  resolveAssetUrl,
  type ApiSuccessResponse,
  type PortalBrandingRecord,
  type SchoolBrandingRecord,
  type SchoolSettingsRecord,
} from '@/utils/api';
import { useSchoolScope } from './use-school-scope';

const BRAND_CSS_VARS = [
  '--primary',
  '--primary-strong',
  '--primary-soft',
  '--primary-surface',
  '--brand-gradient-start',
  '--brand-gradient-end',
  '--brand-outline',
] as const;

export interface SchoolBrandingView {
  schoolId: string | null;
  schoolCode: string | null;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  website: string | null;
  supportEmail: string | null;
}

export function useSchoolBranding(session: AuthSession | null) {
  const { selectedSchoolId } = useSchoolScope();
  const [branding, setBranding] = useState<SchoolBrandingView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      if (!session) {
        if (active) {
          setBranding(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        if (session.user.role === 'PARENT') {
          const response = await apiFetch<ApiSuccessResponse<PortalBrandingRecord>>(
            '/parent/branding',
          );

          if (active) {
            setBranding(mapPortalBranding(response.data));
          }

          return;
        }

        if (session.user.role === 'STUDENT') {
          const response = await apiFetch<ApiSuccessResponse<PortalBrandingRecord>>(
            '/student/branding',
          );

          if (active) {
            setBranding(mapPortalBranding(response.data));
          }

          return;
        }

        if (
          session.user.role === 'SUPER_ADMIN' ||
          session.user.role === 'SCHOOL_ADMIN'
        ) {
          const [schoolResponse, brandingResponse] = await Promise.all([
            apiFetch<ApiSuccessResponse<SchoolSettingsRecord>>('/settings/school'),
            apiFetch<ApiSuccessResponse<SchoolBrandingRecord>>('/settings/branding'),
          ]);

          if (active) {
            setBranding({
              schoolId: schoolResponse.data.schoolId,
              schoolCode: schoolResponse.data.schoolCode,
              schoolName: schoolResponse.data.name,
              logoUrl: resolveAssetUrl(brandingResponse.data.logoUrl),
              primaryColor: brandingResponse.data.primaryColor,
              secondaryColor: brandingResponse.data.secondaryColor,
              website: brandingResponse.data.website,
              supportEmail: brandingResponse.data.supportEmail,
            });
          }

          return;
        }

        if (active) {
          setBranding(null);
        }
      } catch {
        if (active) {
          setBranding(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBranding();

    return () => {
      active = false;
    };
  }, [
    selectedSchoolId,
    session?.accessToken,
    session?.user.role,
    session?.user.schoolId,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const cssVars = getBrandCssVars(
      branding?.primaryColor ?? null,
      branding?.secondaryColor ?? null,
    );

    for (const key of BRAND_CSS_VARS) {
      const value = cssVars[key];

      if (value) {
        root.style.setProperty(key, value);
      } else {
        root.style.removeProperty(key);
      }
    }

    return () => {
      for (const key of BRAND_CSS_VARS) {
        root.style.removeProperty(key);
      }
    };
  }, [branding?.primaryColor, branding?.secondaryColor]);

  return {
    branding,
    loading,
  };
}

function mapPortalBranding(record: PortalBrandingRecord): SchoolBrandingView {
  return {
    schoolId: record.schoolId,
    schoolCode: record.schoolCode,
    schoolName: record.schoolName,
    logoUrl: resolveAssetUrl(record.logoUrl),
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    website: record.website,
    supportEmail: record.supportEmail,
  };
}

function getBrandCssVars(primaryColor: string | null, secondaryColor: string | null) {
  const primary = normalizeHexColor(primaryColor);
  const secondary = normalizeHexColor(secondaryColor);

  if (!primary) {
    return {
      '--primary': '',
      '--primary-strong': '',
      '--primary-soft': '',
      '--primary-surface': '',
      '--brand-gradient-start': '',
      '--brand-gradient-end': '',
      '--brand-outline': '',
    } as Record<(typeof BRAND_CSS_VARS)[number], string>;
  }

  const primaryRgb = hexToRgb(primary);
  const strong = secondary ?? darkenHexColor(primary, 0.18) ?? primary;
  const strongRgb = hexToRgb(strong);

  return {
    '--primary': primary,
    '--primary-strong': strong,
    '--primary-soft': rgbaString(primaryRgb, 0.14),
    '--primary-surface': rgbaString(primaryRgb, 0.08),
    '--brand-gradient-start': rgbaString(primaryRgb, 0.26),
    '--brand-gradient-end': rgbaString(strongRgb, 0.24),
    '--brand-outline': rgbaString(primaryRgb, 0.18),
  } as Record<(typeof BRAND_CSS_VARS)[number], string>;
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(normalized)) {
    return null;
  }

  if (normalized.length === 4) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return normalized.toLowerCase();
}

function hexToRgb(value: string) {
  const normalized = value.replace('#', '');

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function darkenHexColor(value: string, amount: number) {
  const { r, g, b } = hexToRgb(value);
  const next = {
    r: Math.max(0, Math.round(r * (1 - amount))),
    g: Math.max(0, Math.round(g * (1 - amount))),
    b: Math.max(0, Math.round(b * (1 - amount))),
  };

  return `#${toHex(next.r)}${toHex(next.g)}${toHex(next.b)}`;
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}

function rgbaString(
  color: {
    r: number;
    g: number;
    b: number;
  },
  alpha: number,
) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

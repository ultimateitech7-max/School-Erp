'use client';

import { useEffect, useState } from 'react';
import { BrandingForm } from './components/BrandingForm';
import { ModuleToggleList } from './components/ModuleToggleList';
import { SchoolSettingsForm } from './components/SchoolSettingsForm';
import {
  apiFetch,
  type ApiSuccessResponse,
  type SchoolBrandingFormPayload,
  type SchoolBrandingRecord,
  type SchoolModuleToggleRecord,
  type SchoolModulesFormPayload,
  type SchoolSettingsFormPayload,
  type SchoolSettingsRecord,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

export default function SettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettingsRecord | null>(null);
  const [branding, setBranding] = useState<SchoolBrandingRecord | null>(null);
  const [modules, setModules] = useState<SchoolModuleToggleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchool, setSavingSchool] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoading(true);

    void Promise.all([
      apiFetch<ApiSuccessResponse<SchoolSettingsRecord>>('/settings/school'),
      apiFetch<ApiSuccessResponse<SchoolBrandingRecord>>('/settings/branding'),
      apiFetch<ApiSuccessResponse<SchoolModuleToggleRecord[]>>('/settings/modules'),
    ])
      .then(([schoolResponse, brandingResponse, modulesResponse]) => {
        setSchoolSettings(schoolResponse.data);
        setBranding(brandingResponse.data);
        setModules(modulesResponse.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load settings.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  const handleSaveSchool = async (payload: SchoolSettingsFormPayload) => {
    setSavingSchool(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<SchoolSettingsRecord>>(
        '/settings/school',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      setSchoolSettings(response.data);
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to update school settings.',
      });
    } finally {
      setSavingSchool(false);
    }
  };

  const handleSaveBranding = async (payload: SchoolBrandingFormPayload) => {
    setSavingBranding(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<SchoolBrandingRecord>>(
        '/settings/branding',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      setBranding(response.data);
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to update branding.',
      });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveModules = async (payload: SchoolModulesFormPayload) => {
    setSavingModules(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<SchoolModuleToggleRecord[]>>(
        '/settings/modules',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      setModules(response.data);
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to update modules.',
      });
    } finally {
      setSavingModules(false);
    }
  };

  const canManageSettings =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'SCHOOL_ADMIN';

  if (!session) {
    return (
      <section className="card panel">
        <p>Loading session...</p>
      </section>
    );
  }

  if (!canManageSettings) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">You do not have permission to manage settings.</p>
      </section>
    );
  }

  if (loading || !schoolSettings || !branding) {
    return (
      <section className="card panel">
        <p>Loading settings...</p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      {message ? (
        <section className="card panel">
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>
            {message.text}
          </p>
        </section>
      ) : null}

      <div className="academic-grid">
        <SchoolSettingsForm
          initialValue={schoolSettings}
          isSubmitting={savingSchool}
          onSubmit={handleSaveSchool}
        />
        <BrandingForm
          initialValue={branding}
          isSubmitting={savingBranding}
          onSubmit={handleSaveBranding}
        />
      </div>

      <ModuleToggleList
        isSubmitting={savingModules}
        modules={modules}
        onSubmit={handleSaveModules}
      />
    </div>
  );
}

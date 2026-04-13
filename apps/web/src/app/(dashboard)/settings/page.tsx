'use client';

import { useEffect, useState } from 'react';
import { BrandingForm } from './components/BrandingForm';
import { ModuleToggleList } from './components/ModuleToggleList';
import { ReceiptTemplateForm } from './components/ReceiptTemplateForm';
import { SchoolSettingsForm } from './components/SchoolSettingsForm';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type FeeReceiptTemplateFormPayload,
  type FeeReceiptTemplateRecord,
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
  const [receiptTemplate, setReceiptTemplate] = useState<FeeReceiptTemplateRecord | null>(null);
  const [modules, setModules] = useState<SchoolModuleToggleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchool, setSavingSchool] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingReceiptTemplate, setSavingReceiptTemplate] = useState(false);
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

    const canManageModules = session.user.role === 'SUPER_ADMIN';

    void Promise.all([
      apiFetch<ApiSuccessResponse<SchoolSettingsRecord>>('/settings/school'),
      apiFetch<ApiSuccessResponse<SchoolBrandingRecord>>('/settings/branding'),
      apiFetch<ApiSuccessResponse<FeeReceiptTemplateRecord>>('/settings/receipt-template'),
      canManageModules
        ? apiFetch<ApiSuccessResponse<SchoolModuleToggleRecord[]>>('/settings/modules')
        : Promise.resolve(null),
    ])
      .then(([schoolResponse, brandingResponse, receiptTemplateResponse, modulesResponse]) => {
        setSchoolSettings(schoolResponse.data);
        setBranding(brandingResponse.data);
        setReceiptTemplate(receiptTemplateResponse.data);
        setModules(modulesResponse?.data ?? []);
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

  const handleUploadBrandingLogo = async (file: File) => {
    setSavingBranding(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch<ApiSuccessResponse<SchoolBrandingRecord>>(
        '/settings/branding/logo',
        {
          method: 'POST',
          body: formData,
        },
      );

      setBranding(response.data);
      setMessage({
        type: 'success',
        text: response.message,
      });

      return response.data;
    } catch (error) {
      const text =
        error instanceof Error ? error.message : 'Failed to upload branding logo.';

      setMessage({
        type: 'error',
        text,
      });

      throw error;
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

  const handleSaveReceiptTemplate = async (
    payload: FeeReceiptTemplateFormPayload,
  ) => {
    setSavingReceiptTemplate(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<FeeReceiptTemplateRecord>>(
        '/settings/receipt-template',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      setReceiptTemplate(response.data);
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
            : 'Failed to update receipt template.',
      });
    } finally {
      setSavingReceiptTemplate(false);
    }
  };

  const handleUploadReceiptSignature = async (file: File) => {
    setSavingReceiptTemplate(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch<ApiSuccessResponse<FeeReceiptTemplateRecord>>(
        '/settings/receipt-template/signature',
        {
          method: 'POST',
          body: formData,
        },
      );

      setReceiptTemplate(response.data);
      setMessage({
        type: 'success',
        text: response.message,
      });

      return response.data;
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Failed to upload receipt signature.';

      setMessage({
        type: 'error',
        text,
      });

      throw error;
    } finally {
      setSavingReceiptTemplate(false);
    }
  };

  const canManageSettings =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'SCHOOL_ADMIN';
  const canManageModules = session?.user.role === 'SUPER_ADMIN';

  if (!session) {
    return (
      <section className="card panel">
        <Spinner label="Loading settings session..." />
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

  if (loading || !schoolSettings || !branding || !receiptTemplate) {
    return (
      <section className="card panel">
        <Spinner label="Loading settings..." />
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
          onUploadLogo={handleUploadBrandingLogo}
        />
      </div>

      <ReceiptTemplateForm
        branding={branding}
        initialValue={receiptTemplate}
        isSubmitting={savingReceiptTemplate}
        onSubmit={handleSaveReceiptTemplate}
        onUploadSignature={handleUploadReceiptSignature}
        schoolSettings={schoolSettings}
      />

      {canManageModules ? (
        <ModuleToggleList
          isSubmitting={savingModules}
          modules={modules}
          onSubmit={handleSaveModules}
        />
      ) : null}
    </div>
  );
}

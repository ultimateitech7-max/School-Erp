'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { CheckIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type AdmissionApplicationRecord,
  type ApiSuccessResponse,
  type PublicAdmissionInquiryPayload,
  type PublicAdmissionSchoolOption,
} from '@/utils/api';

const initialForm: PublicAdmissionInquiryPayload = {
  schoolId: '',
  studentName: '',
  fatherName: '',
  motherName: '',
  phone: '',
  email: '',
  address: '',
  classApplied: '',
  previousSchool: '',
  dob: '',
  remarks: '',
};

export function PublicAdmissionForm() {
  const searchParams = useSearchParams();
  const [schools, setSchools] = useState<PublicAdmissionSchoolOption[]>([]);
  const [form, setForm] = useState<PublicAdmissionInquiryPayload>(initialForm);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedInquiry, setSubmittedInquiry] =
    useState<AdmissionApplicationRecord | null>(null);

  useEffect(() => {
    setLoadingSchools(true);

    void apiFetch<ApiSuccessResponse<PublicAdmissionSchoolOption[]>>(
      '/public/admissions/schools',
      {
        auth: false,
      },
    )
      .then((response) => {
        setSchools(response.data);

        const requestedSchoolCode = searchParams.get('school')?.trim().toLowerCase();
        const matchedSchool = requestedSchoolCode
          ? response.data.find(
              (item) => item.schoolCode.toLowerCase() === requestedSchoolCode,
            )
          : null;

        setForm((current) => ({
          ...current,
          schoolId:
            current.schoolId || matchedSchool?.id || response.data[0]?.id || '',
        }));
      })
      .catch((loadError) => {
        setSchools([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load schools right now.',
        );
      })
      .finally(() => {
        setLoadingSchools(false);
      });
  }, [searchParams]);

  const updateForm = <K extends keyof PublicAdmissionInquiryPayload>(
    key: K,
    value: PublicAdmissionInquiryPayload[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmittedInquiry(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch<
        ApiSuccessResponse<AdmissionApplicationRecord>
      >(
        '/public/admissions/inquiry',
        {
          auth: false,
          method: 'POST',
          body: JSON.stringify({
            ...form,
            email: form.email?.trim() || undefined,
            previousSchool: form.previousSchool?.trim() || undefined,
            remarks: form.remarks?.trim() || undefined,
          }),
        },
      );

      setSuccessMessage(response.message);
      setSubmittedInquiry(response.data);
      setForm({
        ...initialForm,
        schoolId: form.schoolId,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit your inquiry right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout auth-layout-application">
      <section className="auth-hero auth-hero-application">
        <div className="auth-hero-top">
          <div className="auth-hero-badge">Admission Inquiry</div>
          <h1>Start your school admission inquiry online.</h1>
          <p>
            Fill in student and parent details once. The school admissions team will
            receive your inquiry in their dashboard and continue the review flow from
            there.
          </p>
        </div>

        <div className="auth-hero-process">
          {['Submit form', 'School reviews', 'Student enrolls'].map((step, index) => (
            <div className="auth-hero-step" key={step}>
              <span className="auth-hero-step-index">0{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>

        <div className="auth-feature-list auth-feature-list-application">
          {[
            'Inquiry goes directly into the admissions workflow',
            'No login needed for parents or students',
            'School team can review, approve, and enroll later',
          ].map((item) => (
            <div className="auth-feature-item" key={item}>
              <span className="auth-feature-icon">
                <CheckIcon />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {submittedInquiry ? (
          <div className="subtle-card auth-hero-summary">
            <strong>Inquiry ID</strong>
            <p className="muted-text">{submittedInquiry.id}</p>
            <strong>Status</strong>
            <p className="muted-text">{submittedInquiry.status}</p>
          </div>
        ) : null}
      </section>

      <Card className="auth-card auth-card-application">
        {loadingSchools ? (
          <div className="auth-form">
            <Spinner label="Loading inquiry form..." />
          </div>
        ) : (
          <form className="auth-form auth-form-application" onSubmit={handleSubmit}>
            <div className="auth-form-copy">
              <span className="eyebrow">Public Form</span>
              <h2>Apply for admission</h2>
              <p className="muted-text">
                Submit your inquiry and the school team will follow up from the
                admissions desk.
              </p>
            </div>

            <div className="form-grid form-grid-application">
              <Field label="School">
                <Select
                  required
                  value={form.schoolId}
                  onChange={(event) => updateForm('schoolId', event.target.value)}
                >
                  <option value="">Select school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Class Applied">
                <Input
                  placeholder="Nursery / Class 1 / Grade 6"
                  required
                  value={form.classApplied}
                  onChange={(event) => updateForm('classApplied', event.target.value)}
                />
              </Field>

              <Field label="Date of Birth">
                <Input
                  required
                  type="date"
                  value={form.dob}
                  onChange={(event) => updateForm('dob', event.target.value)}
                />
              </Field>

              <Field label="Student Name">
                <Input
                  required
                  value={form.studentName}
                  onChange={(event) => updateForm('studentName', event.target.value)}
                />
              </Field>

              <Field label="Father Name">
                <Input
                  required
                  value={form.fatherName}
                  onChange={(event) => updateForm('fatherName', event.target.value)}
                />
              </Field>

              <Field label="Mother Name">
                <Input
                  required
                  value={form.motherName}
                  onChange={(event) => updateForm('motherName', event.target.value)}
                />
              </Field>

              <Field label="Phone Number">
                <Input
                  required
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                />
              </Field>

              <Field label="Email Address" hint="Optional but helpful for follow-up.">
                <Input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(event) => updateForm('email', event.target.value)}
                />
              </Field>

              <Field label="Previous School">
                <Input
                  value={form.previousSchool ?? ''}
                  onChange={(event) =>
                    updateForm('previousSchool', event.target.value)
                  }
                />
              </Field>

              <Field label="Remarks">
                <Textarea
                  rows={3}
                  value={form.remarks ?? ''}
                  onChange={(event) => updateForm('remarks', event.target.value)}
                />
              </Field>

              <Field className="form-grid-span-2" label="Address">
                <Textarea
                  required
                  rows={3}
                  value={form.address}
                  onChange={(event) => updateForm('address', event.target.value)}
                />
              </Field>
            </div>

            {error ? <Banner tone="error">{error}</Banner> : null}
            {successMessage ? <Banner tone="success">{successMessage}</Banner> : null}

            <Button
              className="auth-submit"
              disabled={isSubmitting}
              size="lg"
              type="submit"
            >
              {isSubmitting ? 'Submitting inquiry...' : 'Submit Inquiry'}
            </Button>

            <p className="muted-text">
              Already have login details? <Link className="text-link" href="/login">Sign in here</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}

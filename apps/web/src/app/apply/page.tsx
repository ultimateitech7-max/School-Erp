import { Suspense } from 'react';
import { PublicAdmissionForm } from '@/components/admissions/public-admission-form';
import { Spinner } from '@/components/ui/spinner';

export default function ApplyPage() {
  return (
    <Suspense fallback={<Spinner label="Loading admission inquiry..." />}>
      <PublicAdmissionForm />
    </Suspense>
  );
}

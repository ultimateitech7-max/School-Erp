'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { CheckIcon, DashboardIcon } from '@/components/ui/icons';

export function LoginForm() {
  const { login, isPending } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await login({ email, password });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to login right now.',
      );
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="auth-hero-badge">
          <DashboardIcon />
          Unified School Operations
        </div>
        <h1>Run your school from a refined command center.</h1>
        <p>
          Manage students, staff, attendance, fees, academics, and results in one
          professional workspace built for school teams.
        </p>

        <div className="auth-feature-list">
          {[
            'Role-aware access for admins, teachers, and staff',
            'Finance, academics, and operations under one dashboard',
            'Responsive workflows designed for daily execution',
          ].map((item) => (
            <div className="auth-feature-item" key={item}>
              <span className="auth-feature-icon">
                <CheckIcon />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <Card className="auth-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-copy">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to School OS</h2>
            <p className="muted-text">
              Continue into your school administration workspace.
            </p>
          </div>

          <div className="auth-form-grid">
            <Field label="Email address">
              <Input
                autoComplete="email"
                id="email"
                name="email"
                placeholder="admin@school.com"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Password">
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                placeholder="Enter your password"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </div>

          {error ? <Banner tone="error">{error}</Banner> : null}

          <Button className="auth-submit" disabled={isPending} size="lg" type="submit">
            {isPending ? 'Signing in...' : 'Continue to dashboard'}
          </Button>

          <p className="muted-text">
            New admission inquiry?{' '}
            <Link className="text-link" href="/apply">
              Apply for admission
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}

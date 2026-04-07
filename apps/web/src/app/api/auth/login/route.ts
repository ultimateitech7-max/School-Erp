import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/utils/api';

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { message: data.message ?? 'Login failed.' },
      { status: response.status },
    );
  }

  cookies().set('erp_access_token', data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json(data);
}


import { createServerClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getUserId(): Promise<string | null> {
  const supabase = createServerClient(cookies());
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export async function requireAuth() {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(error: string, status: number = 400) {
  return NextResponse.json({ error }, { status });
}

export function handleError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message, 400);
  }

  return errorResponse('Internal server error', 500);
}

export function parseSearchParams(url: string) {
  const { searchParams } = new URL(url);
  return Object.fromEntries(searchParams.entries());
}

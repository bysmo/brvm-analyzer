import { NextResponse } from 'next/server';
import { validateEmailByOtp } from '@/lib/auth/auth';
import { rateLimit, resetRateLimit } from '@/lib/auth/rate-limiter';

export const dynamic = 'force-dynamic';

interface ValidateOtpBody {
  email: string;
  otp: string;
}

export async function POST(request: Request) {
  let body: ValidateOtpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.email || !body.otp) {
    return NextResponse.json({ error: 'Email et code OTP requis' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(body.otp)) {
    return NextResponse.json({ error: 'Le code OTP doit contenir 6 chiffres' }, { status: 400 });
  }

  // ── Rate Limiting : max 5 tentatives par email sur 10 minutes ──────────────
  const rlKey = `otp:${body.email.toLowerCase().trim()}`;
  const rl = rateLimit(rlKey, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.message },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const result = await validateEmailByOtp(body.email, body.otp);

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  // OTP valide → réinitialise le compteur
  resetRateLimit(rlKey);

  return NextResponse.json({
    success: true,
    message: result.message,
  });
}


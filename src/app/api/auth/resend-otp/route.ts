import { NextResponse } from 'next/server';
import { resendOtp } from '@/lib/auth/auth';
import { sendEmail, emailValidationTemplate } from '@/lib/email/mailer';
import { rateLimit } from '@/lib/auth/rate-limiter';

export const dynamic = 'force-dynamic';

interface ResendBody {
  email: string;
}

export async function POST(request: Request) {
  let body: ResendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 });
  }

  // ── Rate Limiting : max 3 renvois par email sur 60 minutes ─────────────────
  // Protège contre le spam d'emails et l'épuisement financier des APIs SMTP
  const rlKey = `resend-otp:${body.email.toLowerCase().trim()}`;
  const rl = rateLimit(rlKey, { maxAttempts: 3, windowMs: 60 * 60 * 1000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.message },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const result = await resendOtp(body.email);

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  // Renvoie l'email avec l'OTP
  if (result.otp) {
    const validationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/validate`;
    const emailContent = emailValidationTemplate({
      firstName: null,
      email: body.email,
      validationUrl,
      otp: result.otp,
    });

    const emailResult = await sendEmail({
      to: body.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      emailSent: emailResult.success,
      emailDemoMode: emailResult.demoMode || false,
      demoOtp: emailResult.demoMode ? result.otp : undefined,
    });
  }

  return NextResponse.json({ success: true, message: result.message });
}


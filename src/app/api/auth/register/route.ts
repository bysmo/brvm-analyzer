import { NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/auth';
import { sendEmail, emailValidationTemplate } from '@/lib/email/mailer';

export const dynamic = 'force-dynamic';

interface RegisterBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
}

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  // Validations
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 });
  }

  // Validation pays si fourni
  const validCountries = ['CI', 'SN', 'BF', 'ML', 'BJ'];
  if (body.country && !validCountries.includes(body.country)) {
    return NextResponse.json({ error: `Pays invalide. Pays supportés: ${validCountries.join(', ')}` }, { status: 400 });
  }

  try {
    const { user, validationToken, validationOtp } = await createUser({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      country: body.country,
    });

    // Envoie l'email de validation (avec OTP)
    const validationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/validate/${validationToken}`;
    const emailContent = emailValidationTemplate({
      firstName: user.firstName,
      email: user.email,
      validationUrl,
      otp: validationOtp,
    });

    const emailResult = await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: true,
      message: 'Compte créé. Un code OTP de validation vous a été envoyé par email.',
      userId: user.id,
      email: user.email,
      emailSent: emailResult.success,
      emailDemoMode: emailResult.demoMode || false,
      // En mode démo seulement, on retourne l'OTP pour permettre les tests
      demoOtp: emailResult.demoMode ? validationOtp : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur lors de la création du compte' }, { status: 400 });
  }
}

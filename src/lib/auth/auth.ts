// Service d'authentification: gestion des utilisateurs, sessions JWT, validation email
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ── Vérification JWT_SECRET en production ─────────────────────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('[auth] FATAL: La variable JWT_SECRET doit être définie en production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '30', 10);

// ── Compte admin depuis .env (accès de secours) ───────────────────────────────
const ENV_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ENV_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

/** Vérifie si les identifiants fournis correspondent au compte admin .env */
function isEnvAdminCredentials(email: string, password: string): boolean {
  if (!ENV_ADMIN_EMAIL || !ENV_ADMIN_PASSWORD) return false;
  return email.toLowerCase().trim() === ENV_ADMIN_EMAIL && password === ENV_ADMIN_PASSWORD;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  emailValidated: boolean;
  role: string;
}

export interface SessionUser extends AuthUser {
  subscription: {
    isActive: boolean;
    planName: string | null;
    endDate: Date | null;
    daysRemaining: number;
  } | null;
}

// === HACHAGE MOT DE PASSE ===

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// === TOKENS ===

export function generateEmailValidationToken(): { token: string; otp: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  // OTP 6 chiffres (suffisamment sécurisé pour une validation email 24h)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  return { token, otp, expiresAt };
}

export function generateSessionToken(userId: string): string {
  return jwt.sign({ userId, iat: Date.now() }, JWT_SECRET, { expiresIn: `${JWT_EXPIRES_DAYS}d` });
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    return payload;
  } catch {
    return null;
  }
}

// === CRUD UTILISATEURS ===

export async function createUser(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
}): Promise<{ user: AuthUser; validationToken: string; validationOtp: string }> {
  const existing = await db.user.findUnique({ where: { email: params.email.toLowerCase() } });
  if (existing) {
    throw new Error('Un compte existe déjà avec cet email');
  }

  const passwordHash = await hashPassword(params.password);
  const { token: validationToken, otp: validationOtp, expiresAt } = generateEmailValidationToken();

  const user = await db.user.create({
    data: {
      email: params.email.toLowerCase(),
      passwordHash,
      firstName: params.firstName || null,
      lastName: params.lastName || null,
      phone: params.phone || null,
      country: params.country || null,
      emailValidated: false,
      emailValidationToken: validationToken,
      emailValidationOtp: validationOtp,
      emailValidationExpiresAt: expiresAt,
    },
  });

  return {
    user: toAuthUser(user),
    validationToken,
    validationOtp,
  };
}

export async function authenticateUser(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  // ── Bypass admin .env ──────────────────────────────────────────────────────
  // Si les identifiants correspondent au compte admin défini dans .env,
  // on authentifie directement sans passer par la base de données.
  if (isEnvAdminCredentials(email, password)) {
    // Cherche ou crée le compte admin en base pour avoir un vrai userId
    let adminUser = await db.user.findUnique({ where: { email: ENV_ADMIN_EMAIL } });
    if (!adminUser) {
      // Crée à la volée si absent (premier démarrage)
      const passwordHash = await bcrypt.hash(ENV_ADMIN_PASSWORD, 12);
      adminUser = await db.user.create({
        data: {
          email: ENV_ADMIN_EMAIL,
          passwordHash,
          firstName: 'Admin',
          lastName: 'BRVM',
          role: 'admin',
          emailValidated: true,
        },
      });
    } else if (adminUser.role !== 'admin') {
      // S'assure que le compte a le bon rôle
      adminUser = await db.user.update({
        where: { id: adminUser.id },
        data: { role: 'admin', emailValidated: true },
      });
    }
    const token = generateSessionToken(adminUser.id);
    await db.session.create({
      data: {
        userId: adminUser.id,
        token,
        expiresAt: new Date(Date.now() + JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return { user: toAuthUser(adminUser), token };
  }

  // ── Authentification normale ───────────────────────────────────────────────
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new Error('Email ou mot de passe incorrect');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Email ou mot de passe incorrect');
  }

  // L'admin peut se connecter sans validation d'email
  // Les utilisateurs normaux doivent avoir validé leur email
  if (!user.emailValidated && user.role !== 'admin') {
    throw new Error('Email non validé. Vérifiez votre boîte mail pour le code OTP de validation.');
  }

  const token = generateSessionToken(user.id);

  // Stocke la session en base
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { user: toAuthUser(user), token };
}

export async function validateEmail(token: string): Promise<{ success: boolean; message: string }> {
  const user = await db.user.findFirst({
    where: {
      emailValidationToken: token,
      emailValidationExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    return { success: false, message: 'Lien de validation invalide ou expiré' };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailValidated: true,
      emailValidationToken: null,
      emailValidationOtp: null,
      emailValidationExpiresAt: null,
    },
  });

  return { success: true, message: 'Email validé avec succès ! Vous pouvez maintenant vous connecter.' };
}

// Validation par code OTP (6 chiffres)
export async function validateEmailByOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
  const user = await db.user.findFirst({
    where: {
      email: email.toLowerCase(),
      emailValidationOtp: otp,
      emailValidationExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    // Vérifie si l'utilisateur existe pour donner un message approprié
    const exists = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!exists) {
      return { success: false, message: 'Aucun compte associé à cet email' };
    }
    if (exists.emailValidated) {
      return { success: false, message: 'Ce compte est déjà validé. Vous pouvez vous connecter.' };
    }
    return { success: false, message: 'Code OTP invalide ou expiré' };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailValidated: true,
      emailValidationToken: null,
      emailValidationOtp: null,
      emailValidationExpiresAt: null,
    },
  });

  return { success: true, message: 'Email validé avec succès ! Vous pouvez maintenant vous connecter.' };
}

// Renvoi d'un nouvel OTP
export async function resendOtp(email: string): Promise<{ success: boolean; message: string; otp?: string }> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Pour des raisons de sécurité, on ne révèle pas que l'email n'existe pas
    return { success: true, message: 'Si un compte existe, un nouvel OTP a été envoyé' };
  }
  if (user.emailValidated) {
    return { success: false, message: 'Ce compte est déjà validé' };
  }

  const { token, otp, expiresAt } = generateEmailValidationToken();
  await db.user.update({
    where: { id: user.id },
    data: {
      emailValidationToken: token,
      emailValidationOtp: otp,
      emailValidationExpiresAt: expiresAt,
    },
  });

  return {
    success: true,
    message: 'Nouvel OTP envoyé',
    otp,  // retourné pour le mode démo (affichage console)
  };
}

export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  // Récupère le token depuis le header Authorization ou le cookie
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Essaie le cookie
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/brvm_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Vérifie l'abonnement actif
  const activeSubscription = await db.subscription.findFirst({
    where: {
      userId: session.userId,
      status: 'active',
      endDate: { gt: new Date() },
    },
    orderBy: { endDate: 'desc' },
  });

  // L'admin a un accès illimité (pas besoin d'abonnement)
  if (session.user.role === 'admin') {
    return {
      ...toAuthUser(session.user),
      subscription: {
        isActive: true,
        planName: 'ADMIN (accès illimité)',
        endDate: null,
        daysRemaining: 9999,
      },
    };
  }

  const daysRemaining = activeSubscription
    ? Math.ceil((activeSubscription.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  return {
    ...toAuthUser(session.user),
    subscription: activeSubscription
      ? {
          isActive: true,
          planName: activeSubscription.planName,
          endDate: activeSubscription.endDate,
          daysRemaining,
        }
      : null,
  };
}

export async function logout(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } }).catch(() => {});
}

function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    country: user.country,
    emailValidated: user.emailValidated,
    role: user.role,
  };
}

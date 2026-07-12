// Script d'initialisation du compte admin
// Les identifiants sont lus depuis les variables d'environnement ADMIN_EMAIL et ADMIN_PASSWORD
// Si non définis, un avertissement est émis et la création est ignorée.
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function ensureAdminUserExists(): Promise<void> {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    console.warn(
      '[ensureAdminUserExists] ⚠️  ADMIN_EMAIL et/ou ADMIN_PASSWORD non définis dans .env. ' +
      "Aucun compte admin n'a été créé automatiquement."
    );
    return;
  }

  try {
    const existing = await db.user.findUnique({ where: { email: adminEmail } });

    if (existing) {
      // Synchronise le hash du mot de passe si le compte existe déjà
      if (existing.role !== 'admin' || !existing.emailValidated) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await db.user.update({
          where: { id: existing.id },
          data: {
            role: 'admin',
            emailValidated: true,
            passwordHash,
            firstName: existing.firstName || 'Admin',
            lastName: existing.lastName || 'BRVM',
            emailValidationToken: null,
            emailValidationOtp: null,
            emailValidationExpiresAt: null,
          },
        });
        console.log('[ensureAdminUserExists] ✅ Compte admin mis à jour depuis .env');
      }
      return;
    }

    // Crée le compte admin pour la première fois
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'BRVM',
        role: 'admin',
        emailValidated: true,
        country: 'CI',
      },
    });
    console.log(`[ensureAdminUserExists] ✅ Compte admin créé pour: ${adminEmail}`);
  } catch (err) {
    console.error('[ensureAdminUserExists] Erreur:', err);
  }
}

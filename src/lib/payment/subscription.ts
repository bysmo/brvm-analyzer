// Service d'activation d'abonnement
import { db } from '@/lib/db';
import { sendEmail, subscriptionConfirmationTemplate } from '@/lib/email/mailer';
import { getPlanById } from './plans';

export interface ActivateSubscriptionParams {
  userId: string;
  planId: string;
  paymentId: string;
  paymentMethod: string;  // 'orange_money' | 'visa_3ds'
  providerPaymentId: string;
}

export interface ActivateSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  startDate?: Date;
  endDate?: Date;
  message: string;
}

export async function activateSubscription(params: ActivateSubscriptionParams): Promise<ActivateSubscriptionResult> {
  const plan = getPlanById(params.planId);
  if (!plan) {
    return { success: false, message: 'Plan inconnu' };
  }

  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    return { success: false, message: 'Utilisateur introuvable' };
  }

  // Calcule les dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + plan.durationMonths);

  // Désactive les abonnements actifs précédents
  await db.subscription.updateMany({
    where: { userId: params.userId, status: 'active' },
    data: { status: 'expired' },
  });

  // Crée le nouvel abonnement
  const subscription = await db.subscription.create({
    data: {
      userId: params.userId,
      planId: plan.id,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      amountXOF: plan.priceXOF,
      startDate,
      endDate,
      status: 'active',
      paymentId: params.paymentId,
    },
  });

  // Met à jour le paiement associé
  await db.payment.update({
    where: { id: params.paymentId },
    data: {
      status: 'succeeded',
      subscriptionId: subscription.id,
      providerPaymentId: params.providerPaymentId,
    },
  });

  // Envoie l'email de confirmation
  const emailContent = subscriptionConfirmationTemplate({
    firstName: user.firstName,
    email: user.email,
    planName: plan.name,
    amountXOF: plan.priceXOF,
    startDate,
    endDate,
    paymentMethod: params.paymentMethod === 'orange_money' ? 'Orange Money' : 'Carte VISA (3DS)',
  });

  await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  return {
    success: true,
    subscriptionId: subscription.id,
    startDate,
    endDate,
    message: `Abonnement ${plan.name} activé jusqu'au ${endDate.toLocaleDateString('fr-FR')}`,
  };
}

// === VÉRIFICATION D'ABONNEMENT ACTIF ===

export interface SubscriptionStatus {
  isActive: boolean;
  planName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number;
}

export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      endDate: { gt: new Date() },
    },
    orderBy: { endDate: 'desc' },
  });

  if (!sub) {
    return {
      isActive: false,
      planName: null,
      startDate: null,
      endDate: null,
      daysRemaining: 0,
    };
  }

  const daysRemaining = Math.ceil((sub.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return {
    isActive: true,
    planName: sub.planName,
    startDate: sub.startDate,
    endDate: sub.endDate,
    daysRemaining,
  };
}

// === DÉSACTIVATION AUTOMATIQUE DES ABONNEMENTS EXPIRÉS ===

export async function expireOldSubscriptions(): Promise<{ count: number }> {
  const result = await db.subscription.updateMany({
    where: {
      status: 'active',
      endDate: { lt: new Date() },
    },
    data: { status: 'expired' },
  });

  if (result.count > 0) {
    console.log(`[expireOldSubscriptions] ${result.count} abonnement(s) expiré(s) automatiquement`);
  }

  return { count: result.count };
}

// Service Orange Money - Intégration API pour 5 pays UEMOA
// Mode hybride:
//   - Si ORANGE_MONEY_ENV=sandbox OU pas de clés API → mode démo (toujours succès)
//   - Si ORANGE_MONEY_ENV=production ET clés API configurées → vraies requêtes API

import { db } from '@/lib/db';
import crypto from 'crypto';

export interface OrangeMoneyCountry {
  code: string;          // CI, SN, BF, ML, BJ
  name: string;
  flag: string;
  currency: string;
  merchantNumber: string;
  clientId: string | null;
  clientSecret: string | null;
  apiBaseUrl: string;
}

export const ORANGE_MONEY_COUNTRIES: OrangeMoneyCountry[] = [
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    flag: '🇨🇮',
    currency: 'XOF',
    merchantNumber: process.env.ORANGE_MONEY_MERCHANT_NUMBER_CI || '',
    clientId: process.env.ORANGE_MONEY_CLIENT_ID_CI || null,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET_CI || null,
    apiBaseUrl: 'https://api.orange.com/orange-money-webpay/ci/v1',
  },
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    currency: 'XOF',
    merchantNumber: process.env.ORANGE_MONEY_MERCHANT_NUMBER_SN || '',
    clientId: process.env.ORANGE_MONEY_CLIENT_ID_SN || null,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET_SN || null,
    apiBaseUrl: 'https://api.orange.com/orange-money-webpay/sn/v1',
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    currency: 'XOF',
    merchantNumber: process.env.ORANGE_MONEY_MERCHANT_NUMBER_BF || '',
    clientId: process.env.ORANGE_MONEY_CLIENT_ID_BF || null,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET_BF || null,
    apiBaseUrl: 'https://api.orange.com/orange-money-webpay/bf/v1',
  },
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    currency: 'XOF',
    merchantNumber: process.env.ORANGE_MONEY_MERCHANT_NUMBER_ML || '',
    clientId: process.env.ORANGE_MONEY_CLIENT_ID_ML || null,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET_ML || null,
    apiBaseUrl: 'https://api.orange.com/orange-money-webpay/ml/v1',
  },
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    currency: 'XOF',
    merchantNumber: process.env.ORANGE_MONEY_MERCHANT_NUMBER_BJ || '',
    clientId: process.env.ORANGE_MONEY_CLIENT_ID_BJ || null,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET_BJ || null,
    apiBaseUrl: 'https://api.orange.com/orange-money-webpay/bj/v1',
  },
];

export function getCountry(code: string): OrangeMoneyCountry | undefined {
  return ORANGE_MONEY_COUNTRIES.find(c => c.code === code);
}

export function isSandboxMode(): boolean {
  const env = process.env.ORANGE_MONEY_ENV || 'sandbox';
  return env === 'sandbox' || !ORANGE_MONEY_COUNTRIES.some(c => c.clientId && c.clientSecret);
}

export interface InitiatePaymentParams {
  paymentId: string;  // ID interne du paiement (table Payment)
  country: string;
  amount: number;
  customerMsisdn?: string;
  description: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  reference: string;       // référence interne
  providerPaymentId?: string;  // ID paiement côté Orange Money
  otpCode?: string;        // mode sandbox: code OTP à valider
  paymentUrl?: string;     // URL de paiement Orange Money (mode production)
  message: string;
}

// === INITIATION DE PAIEMENT ===

export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  const country = getCountry(params.country);
  if (!country) {
    return { success: false, reference: '', message: `Pays non supporté: ${params.country}` };
  }

  const reference = generateReference(params.country);

  // Crée l'entrée en base
  await db.orangeMoneyPayment.create({
    data: {
      paymentId: params.paymentId,
      country: params.country,
      merchantNumber: country.merchantNumber,
      customerMsisdn: params.customerMsisdn || null,
      amount: params.amount,
      reference,
      status: 'pending',
    },
  });

  if (isSandboxMode()) {
    // Mode démo: génère un OTP fictif
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await db.orangeMoneyPayment.update({
      where: { reference },
      data: { otpCode },
    });

    return {
      success: true,
      reference,
      providerPaymentId: `SANDBOX-${reference}`,
      otpCode,
      message: `Paiement initié en mode sandbox. Utilisez le code OTP: ${otpCode} pour valider (ou n'importe quel code en démo).`,
    };
  }

  // === MODE PRODUCTION ===
  // Workflow Orange Money Web Payment:
  // 1. Obtenir un token OAuth2
  // 2. Créer une transaction (POST /webpayment)
  // 3. Recevoir une URL de paiement à afficher au client
  // 4. Le client valide sur la page Orange Money
  // 5. Notification webhook + polling pour confirmer

  try {
    const token = await getOAuthToken(country);
    if (!token) {
      return { success: false, reference, message: "Impossible d'obtenir le token OAuth Orange Money" };
    }

    const txnResponse = await fetch(`${country.apiBaseUrl}/webpayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_key: country.merchantNumber,
        currency: country.currency,
        order_id: reference,
        amount: params.amount,
        ref_url: `${process.env.APP_URL}/api/payments/orange-money/confirm`,
        lang: 'fr',
      }),
    });

    if (!txnResponse.ok) {
      const errText = await txnResponse.text();
      throw new Error(`Orange Money API error: ${txnResponse.status} - ${errText}`);
    }

    const txn = await txnResponse.json();
    await db.orangeMoneyPayment.update({
      where: { reference },
      data: { txnId: txn.txn_id || txn.id },
    });

    return {
      success: true,
      reference,
      providerPaymentId: txn.txn_id || txn.id,
      paymentUrl: txn.payment_url || txn.pay_url,
      message: 'Paiement initié. Redirection vers Orange Money...',
    };
  } catch (err: any) {
    console.error('[orangeMoney.initiatePayment] error:', err);
    return { success: false, reference, message: err?.message || "Erreur lors de l'initiation du paiement" };
  }
}

// === CONFIRMATION DE PAIEMENT ===

export interface ConfirmPaymentParams {
  reference: string;
  otpCode?: string;     // mode sandbox
  txnId?: string;       // mode production
}

export interface ConfirmPaymentResult {
  success: boolean;
  status: 'succeeded' | 'failed' | 'pending';
  message: string;
  txnId?: string;
}

export async function confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
  const omPayment = await db.orangeMoneyPayment.findUnique({
    where: { reference: params.reference },
  });

  if (!omPayment) {
    return { success: false, status: 'failed', message: 'Référence de paiement introuvable' };
  }

  if (omPayment.status === 'completed') {
    return { success: true, status: 'succeeded', message: 'Paiement déjà confirmé', txnId: omPayment.txnId || undefined };
  }

  if (isSandboxMode()) {
    // Mode démo: accepter n'importe quel OTP à 6 chiffres
    if (params.otpCode && /^\d{6}$/.test(params.otpCode)) {
      await db.orangeMoneyPayment.update({
        where: { reference: params.reference },
        data: {
          status: 'completed',
          txnId: `SANDBOX-TXN-${Date.now()}`,
          validatedAt: new Date(),
        },
      });
      return {
        success: true,
        status: 'succeeded',
        message: 'Paiement confirmé avec succès (mode sandbox)',
        txnId: `SANDBOX-TXN-${Date.now()}`,
      };
    }
    return { success: false, status: 'failed', message: 'Code OTP invalide (6 chiffres attendus)' };
  }

  // === MODE PRODUCTION ===
  // Vérifier le statut du paiement via l'API Orange Money
  try {
    const country = getCountry(omPayment.country);
    if (!country) throw new Error('Pays introuvable');
    const token = await getOAuthToken(country);
    if (!token) throw new Error('Token OAuth invalide');

    const statusRes = await fetch(`${country.apiBaseUrl}/webpayment/${omPayment.txnId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const status = await statusRes.json();

    if (status.status === 'SUCCESSFUL' || status.status === 'SUCCESS') {
      await db.orangeMoneyPayment.update({
        where: { reference: params.reference },
        data: { status: 'completed', validatedAt: new Date() },
      });
      return { success: true, status: 'succeeded', message: 'Paiement confirmé', txnId: omPayment.txnId || undefined };
    }
    if (status.status === 'PENDING') {
      return { success: false, status: 'pending', message: 'Paiement en cours de traitement' };
    }
    return { success: false, status: 'failed', message: `Paiement échoué: ${status.status}` };
  } catch (err: any) {
    return { success: false, status: 'failed', message: err?.message || 'Erreur confirmation' };
  }
}

// === HELPERS ===

function generateReference(country: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BRVM-${country}-${ts}-${rand}`;
}

async function getOAuthToken(country: OrangeMoneyCountry): Promise<string | null> {
  if (!country.clientId || !country.clientSecret) return null;

  try {
    const res = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${country.clientId}:${country.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[orangeMoney.getOAuthToken] error:', err);
    return null;
  }
}

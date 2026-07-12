// Service d'envoi d'emails
// Mode démo: si SMTP_HOST n'est pas configuré, les emails sont loggés dans la console
// Mode production: utilise nodemailer avec SMTP configuré via env

import nodemailer from 'nodemailer';

const APP_NAME = process.env.APP_NAME || 'BRVM Analyzer';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@brvm-analyzer.com';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || APP_NAME;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST) {
    return null;  // Mode démo
  }
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export interface EmailResult {
  success: boolean;
  message: string;
  previewUrl?: string;  // pour mode démo
  demoMode?: boolean;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const transport = getTransporter();

  if (!transport) {
    // Mode démo: log dans la console + retourne un "preview"
    console.log('\n========== EMAIL (MODE DÉMO) ==========');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log('---');
    console.log(params.text || params.html.replace(/<[^>]*>/g, ' ').trim());
    console.log('======================================\n');

    return {
      success: true,
      message: 'Email simulé (mode démo - SMTP non configuré)',
      previewUrl: `${process.env.APP_URL || 'http://localhost:3000'}/emails/preview`,
      demoMode: true,
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { success: true, message: `Email envoyé: ${info.messageId}` };
  } catch (err: any) {
    console.error('[sendEmail] error:', err);
    return { success: false, message: err?.message || 'Erreur envoi email' };
  }
}

// === TEMPLATES D'EMAILS ===

export function emailValidationTemplate(params: {
  firstName: string | null;
  email: string;
  validationUrl: string;
  otp: string;
}): { subject: string; html: string; text: string } {
  const name = params.firstName || 'Investisseur';
  const subject = `${APP_NAME} - Votre code de validation (valable 24h)`;
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0E1A; color: #E8EEF7; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #161D33; border-radius: 8px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { background: linear-gradient(135deg, #00D678, #00B86A); color: #0A0E1A; padding: 8px 16px; border-radius: 6px; display: inline-block; font-weight: bold; }
    .title { color: #00D678; font-size: 22px; margin: 16px 0 8px; }
    .subtitle { color: #8B95B0; font-size: 14px; margin: 0; }
    .content { color: #E8EEF7; font-size: 15px; line-height: 1.6; margin: 24px 0; text-align: center; }
    .otp-box {
      background: linear-gradient(135deg, #1C2440, #2A3552);
      border: 2px dashed #00D678;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }
    .otp-label { color: #8B95B0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .otp-code {
      font-family: 'Courier New', monospace;
      font-size: 48px;
      font-weight: bold;
      letter-spacing: 0.5em;
      color: #00D678;
      padding: 12px 24px;
      background: #0A0E1A;
      border-radius: 6px;
      display: inline-block;
    }
    .otp-hint { color: #5C6789; font-size: 12px; margin-top: 12px; }
    .button { display: inline-block; background: #00D678; color: #0A0E1A !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 8px 0; }
    .info { background: #1C2440; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #8B95B0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #1F2942; font-size: 12px; color: #5C6789; text-align: center; }
    a { color: #00D678; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${APP_NAME}</div>
      <h1 class="title">Bienvenue ${name} !</h1>
      <p class="subtitle">Validez votre adresse email pour activer votre compte</p>
    </div>
    <div class="content">
      <p>Bonjour ${name},</p>
      <p>Merci de votre inscription. Pour finaliser votre compte et accéder à nos analyses premium de la BRVM, utilisez le code de validation ci-dessous :</p>

      <div class="otp-box">
        <div class="otp-label">Votre code de validation</div>
        <div class="otp-code">${params.otp}</div>
        <div class="otp-hint">⏱ Code valable 24 heures</div>
      </div>

      <p style="font-size: 14px; color: #8B95B0;">Saisissez ce code sur la page de validation pour activer votre compte.</p>

      <div class="info">
        <strong>💡 Vous préférez cliquer ?</strong><br>
        Vous pouvez aussi valider directement via ce lien :<br>
        <a href="${params.validationUrl}" style="word-break: break-all; font-size: 12px;">${params.validationUrl}</a>
      </div>

      <p style="font-size: 13px; color: #5C6789;">Si vous n'avez pas créé de compte sur ${APP_NAME}, vous pouvez ignorer cet email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${APP_NAME}. Tous droits réservés.</p>
      <p>Analyses de la Bourse Régionale des Valeurs Mobilières (BRVM)</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Bonjour ${name},

Merci de votre inscription sur ${APP_NAME}.

VOTRE CODE DE VALIDATION: ${params.otp}

Saisissez ce code sur la page de validation pour activer votre compte.
Ce code est valable 24 heures.

Vous pouvez aussi valider directement via ce lien :
${params.validationUrl}

Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.

© ${new Date().getFullYear()} ${APP_NAME}`;

  return { subject, html, text };
}

export function subscriptionConfirmationTemplate(params: {
  firstName: string | null;
  email: string;
  planName: string;
  amountXOF: number;
  startDate: Date;
  endDate: Date;
  paymentMethod: string;
}): { subject: string; html: string; text: string } {
  const name = params.firstName || 'Investisseur';
  const subject = `${APP_NAME} - Abonnement ${params.planName} activé`;
  const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtAmount = (n: number) => n.toLocaleString('fr-FR') + ' XOF';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0E1A; color: #E8EEF7; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #161D33; border-radius: 8px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { background: linear-gradient(135deg, #00D678, #00B86A); color: #0A0E1A; padding: 8px 16px; border-radius: 6px; display: inline-block; font-weight: bold; }
    .title { color: #00D678; font-size: 22px; margin: 16px 0 8px; }
    .receipt { background: #1C2440; border-radius: 6px; padding: 20px; margin: 16px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1F2942; font-size: 14px; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { color: #8B95B0; }
    .receipt-value { color: #E8EEF7; font-weight: bold; font-family: monospace; }
    .amount { color: #00D678; font-size: 24px; font-weight: bold; text-align: center; padding: 16px 0; }
    .button { display: inline-block; background: #00D678; color: #0A0E1A !important; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 16px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #1F2942; font-size: 12px; color: #5C6789; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${APP_NAME}</div>
      <h1 class="title">Abonnement activé ✓</h1>
    </div>
    <p style="font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
    <p style="font-size: 15px; line-height: 1.6;">Votre abonnement <strong style="color: #00D678;">${params.planName}</strong> est maintenant actif. Vous avez accès à toutes les fonctionnalités premium :</p>
    <ul style="color: #E8EEF7; font-size: 14px;">
      <li>Tableau de bord Recommandations (Top Achats / Top Ventes)</li>
      <li>Analyse détaillée de chaque action (fondamentaux 5 ans, PER, BNPA, DPA)</li>
      <li>Comparaison sectorielle temps réel</li>
      <li>Comparaison de 4 actions côte à côte</li>
      <li>Palmarès complet des 48 actions BRVM</li>
    </ul>
    <div class="receipt">
      <div class="receipt-row">
        <span class="receipt-label">Plan</span>
        <span class="receipt-value">${params.planName}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Méthode de paiement</span>
        <span class="receipt-value">${params.paymentMethod}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Date de début</span>
        <span class="receipt-value">${fmtDate(params.startDate)}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Date d'expiration</span>
        <span class="receipt-value">${fmtDate(params.endDate)}</span>
      </div>
      <div class="amount">${fmtAmount(params.amountXOF)}</div>
    </div>
    <div style="text-align: center;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">Accéder au tableau de bord</a>
    </div>
    <p style="font-size: 13px; color: #8B95B0; margin-top: 24px;">À l'échéance de votre abonnement (${fmtDate(params.endDate)}), votre compte sera automatiquement désactivé. Vous pourrez alors renouveler votre abonnement depuis votre espace compte.</p>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${APP_NAME}. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Bonjour ${name},

Votre abonnement ${params.planName} est maintenant actif !

Détails:
- Plan: ${params.planName}
- Montant: ${fmtAmount(params.amountXOF)}
- Méthode: ${params.paymentMethod}
- Début: ${fmtDate(params.startDate)}
- Expiration: ${fmtDate(params.endDate)}

À l'échéance, votre compte sera désactivé automatiquement.

© ${new Date().getFullYear()} ${APP_NAME}`;

  return { subject, html, text };
}

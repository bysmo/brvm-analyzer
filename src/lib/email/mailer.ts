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

// ── TEMPLATE ALERTE PORTEFEUILLE ─────────────────────────────────────────

export function portfolioAlertTemplate(params: {
  firstName: string | null;
  email: string;
  ticker: string;
  name: string;
  acquisitionPrice: number;
  acquisitionDate: Date;
  quantity: number;
  currentPrice: number;
  grossYieldPct: number;
  annualizedYieldPct: number;
  gainXOF: number;
  yieldThresholdPct: number;
  alertType: 'YIELD_THRESHOLD' | 'SELL_RECOMMENDATION';
}): { subject: string; html: string; text: string } {
  const prenom = params.firstName || 'Investisseur';
  const fmtXOF = (n: number) => n.toLocaleString('fr-FR') + ' XOF';
  const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const isYield = params.alertType === 'YIELD_THRESHOLD';
  const isGain = params.gainXOF >= 0;

  const alertColor = isGain ? '#00D678' : '#FF4757';
  const alertLabel = isYield
    ? `🎯 Seuil de rendement atteint : ${fmtPct(params.grossYieldPct)}`
    : `⚠️ Recommandation VENDRE détectée`;

  const subject = isYield
    ? `${APP_NAME} — 🎯 Alerte rendement : ${params.ticker} a atteint ${fmtPct(params.grossYieldPct)}`
    : `${APP_NAME} — ⚠️ Alerte : recommandation VENDRE pour ${params.ticker}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0E1A; color: #E8EEF7; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #161D33; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0F1628, #1C2440); padding: 28px 32px; border-bottom: 1px solid #1F2942; }
    .logo { background: linear-gradient(135deg, #00D678, #00B86A); color: #0A0E1A; padding: 6px 14px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px; }
    .alert-banner { background: ${isGain ? 'rgba(0,214,120,0.12)' : 'rgba(255,71,87,0.12)'}; border: 1px solid ${alertColor}; border-radius: 8px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .alert-label { color: ${alertColor}; font-size: 18px; font-weight: bold; }
    .body { padding: 24px 32px; }
    .stock-card { background: #1C2440; border-radius: 8px; padding: 20px; margin: 16px 0; }
    .stock-name { font-size: 20px; font-weight: bold; color: #E8EEF7; margin-bottom: 4px; }
    .stock-ticker { font-size: 13px; color: #00D678; font-family: monospace; background: rgba(0,214,120,0.1); padding: 2px 8px; border-radius: 4px; display: inline-block; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
    .metric { background: #0A0E1A; border-radius: 6px; padding: 12px 14px; }
    .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5C6789; margin-bottom: 4px; }
    .metric-value { font-size: 18px; font-weight: bold; color: #E8EEF7; font-family: monospace; }
    .metric-value.positive { color: #00D678; }
    .metric-value.negative { color: #FF4757; }
    .cta { text-align: center; padding: 20px 0; }
    .button { display: inline-block; background: #00D678; color: #0A0E1A !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; }
    .info-box { background: rgba(255,200,0,0.08); border: 1px solid rgba(255,200,0,0.3); border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #FFD700; margin: 16px 0; }
    .footer { padding: 20px 32px; border-top: 1px solid #1F2942; font-size: 12px; color: #5C6789; text-align: center; }
    a { color: #00D678; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${APP_NAME}</div>
      <p style="color: #8B95B0; font-size: 13px; margin: 8px 0 0;">Alerte Portefeuille</p>
    </div>
    <div class="body">
      <p style="font-size: 15px;">Bonjour <strong>${prenom}</strong>,</p>
      <div class="alert-banner">
        <div class="alert-label">${alertLabel}</div>
        <div style="color: #8B95B0; font-size: 13px; margin-top: 4px;">
          ${isYield
            ? `Seuil cible : ${params.yieldThresholdPct.toFixed(1)}% — Rendement actuel : ${fmtPct(params.grossYieldPct)}`
            : `Le moteur d'analyse recommande de vendre cette action`
          }
        </div>
      </div>

      <div class="stock-card">
        <div class="stock-name">${params.name}</div>
        <div class="stock-ticker">${params.ticker.toUpperCase()}</div>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Prix d'acquisition</div>
            <div class="metric-value">${fmtXOF(params.acquisitionPrice)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Prix actuel</div>
            <div class="metric-value">${fmtXOF(params.currentPrice)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Rendement brut</div>
            <div class="metric-value ${isGain ? 'positive' : 'negative'}">${fmtPct(params.grossYieldPct)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Rendement annualisé</div>
            <div class="metric-value ${params.annualizedYieldPct >= 0 ? 'positive' : 'negative'}">${fmtPct(params.annualizedYieldPct)}/an</div>
          </div>
          <div class="metric">
            <div class="metric-label">Gain / Perte</div>
            <div class="metric-value ${isGain ? 'positive' : 'negative'}">${fmtXOF(params.gainXOF)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Qté × Prix achat</div>
            <div class="metric-value">${params.quantity} × ${fmtXOF(params.acquisitionPrice)}</div>
          </div>
        </div>
      </div>

      <div class="info-box">
        💡 <strong>Rappel :</strong> Il s'agit d'une alerte automatique basée sur vos paramètres de portefeuille.
        La décision finale vous appartient. Consultez l'analyse complète avant d'agir.
      </div>

      <div class="cta">
        <a href="${APP_URL}/portfolio" class="button">Voir mon portefeuille</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${APP_NAME} — Analyses BRVM premium</p>
      <p>Vous recevez cet email car vous avez configuré des alertes portefeuille.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Bonjour ${prenom},

ALERTE PORTEFEUILLE — ${params.ticker.toUpperCase()} (${params.name})
${alertLabel}

Détails de la position :
- Prix d'acquisition : ${fmtXOF(params.acquisitionPrice)} (le ${fmtDate(params.acquisitionDate)})
- Prix actuel : ${fmtXOF(params.currentPrice)}
- Quantité : ${params.quantity} titre(s)
- Rendement brut : ${fmtPct(params.grossYieldPct)}
- Rendement annualisé : ${fmtPct(params.annualizedYieldPct)}/an
- Gain/Perte : ${fmtXOF(params.gainXOF)}

Consultez votre portefeuille : ${APP_URL}/portfolio

© ${new Date().getFullYear()} ${APP_NAME}`;

  return { subject, html, text };
}

// ── TEMPLATE DIGEST HEBDOMADAIRE ─────────────────────────────────────────

export interface WeeklyDigestPosition {
  ticker: string;
  name: string;
  quantity: number;
  acquisitionPrice: number;
  currentPrice: number;
  grossYieldPct: number;
  annualizedYieldPct: number;
  gainXOF: number;
  recommandation: string;
  recommandationColor: string;
}

export interface WeeklyDigestNews {
  title: string;
  summary: string;
  url: string;
  date: string;
  category: string;
}

export function weeklyDigestTemplate(params: {
  firstName: string | null;
  email: string;
  positions: WeeklyDigestPosition[];
  totalCurrentValueXOF: number;
  totalGainXOF: number;
  totalGrossYieldPct: number;
  progressionPct: number | null;
  targetAmountXOF: number | null;
  monthlyContribXOF: number | null;
  news: WeeklyDigestNews[];
  weekOf: string;
}): { subject: string; html: string; text: string } {
  const prenom = params.firstName || 'Investisseur';
  const fmtXOF = (n: number) => n.toLocaleString('fr-FR') + ' XOF';
  const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  const totalIsGain = params.totalGainXOF >= 0;
  const subject = `${APP_NAME} — 📊 Bilan hebdomadaire de votre portefeuille — ${params.weekOf}`;

  const positionsRows = params.positions.map(p => {
    const isGain = p.gainXOF >= 0;
    return `
      <tr style="border-bottom: 1px solid #1F2942;">
        <td style="padding: 10px 8px;">
          <div style="font-weight: bold; color: #E8EEF7; font-size: 13px;">${p.ticker.toUpperCase()}</div>
          <div style="color: #8B95B0; font-size: 11px;">${p.name}</div>
        </td>
        <td style="padding: 10px 8px; text-align: right; color: #8B95B0; font-size: 13px;">${p.quantity}</td>
        <td style="padding: 10px 8px; text-align: right; font-size: 13px; color: ${isGain ? '#00D678' : '#FF4757'}; font-weight: bold;">${fmtPct(p.grossYieldPct)}</td>
        <td style="padding: 10px 8px; text-align: right; font-size: 13px; color: ${isGain ? '#00D678' : '#FF4757'};">${fmtXOF(p.gainXOF)}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span style="background: ${p.recommandationColor}22; color: ${p.recommandationColor}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${p.recommandation}</span>
        </td>
      </tr>`;
  }).join('');

  const newsRows = params.news.slice(0, 10).map((n, i) => `
    <div style="padding: 14px 0; ${i > 0 ? 'border-top: 1px solid #1F2942;' : ''}">
      <div style="font-size: 11px; color: #00D678; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">${n.category} • ${n.date}</div>
      <a href="${n.url}" style="color: #E8EEF7; font-size: 14px; font-weight: bold; text-decoration: none;">${n.title}</a>
      <div style="color: #8B95B0; font-size: 12px; margin-top: 4px; line-height: 1.5;">${n.summary}</div>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0E1A; color: #E8EEF7; margin: 0; padding: 20px; }
    .container { max-width: 640px; margin: 0 auto; background: #161D33; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0D1326, #182040); padding: 28px 32px; border-bottom: 1px solid #1F2942; }
    .logo { background: linear-gradient(135deg, #00D678, #00B86A); color: #0A0E1A; padding: 6px 14px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px; }
    .section { padding: 24px 32px; border-bottom: 1px solid #1F2942; }
    .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #5C6789; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi { background: #1C2440; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #5C6789; margin-bottom: 6px; }
    .kpi-value { font-size: 20px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #5C6789; padding: 8px; border-bottom: 1px solid #1F2942; }
    .progress-bar { background: #1C2440; border-radius: 99px; height: 8px; margin: 8px 0; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #00D678, #00B86A); border-radius: 99px; transition: width 0.3s; }
    .button { display: inline-block; background: #00D678; color: #0A0E1A !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; }
    .footer { padding: 20px 32px; font-size: 12px; color: #5C6789; text-align: center; }
    a { color: #00D678; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${APP_NAME}</div>
      <h2 style="color: #E8EEF7; font-size: 20px; margin: 12px 0 4px;">📊 Bilan hebdomadaire</h2>
      <p style="color: #8B95B0; font-size: 13px; margin: 0;">Semaine du ${params.weekOf} • Bonjour ${prenom} !</p>
    </div>

    <!-- RÉSUMÉ PORTEFEUILLE -->
    <div class="section">
      <div class="section-title">📈 Résumé de votre portefeuille</div>
      <div class="summary-grid">
        <div class="kpi">
          <div class="kpi-label">Valeur actuelle</div>
          <div class="kpi-value" style="color: #E8EEF7; font-size: 16px;">${fmtXOF(params.totalCurrentValueXOF)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Gain / Perte</div>
          <div class="kpi-value" style="color: ${totalIsGain ? '#00D678' : '#FF4757'};">${fmtXOF(params.totalGainXOF)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Rendement</div>
          <div class="kpi-value" style="color: ${totalIsGain ? '#00D678' : '#FF4757'};">${fmtPct(params.totalGrossYieldPct)}</div>
        </div>
      </div>
      ${params.targetAmountXOF && params.progressionPct !== null ? `
      <div style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #8B95B0; margin-bottom: 6px;">
          <span>Progression vers l'objectif</span>
          <span style="color: #00D678; font-weight: bold;">${params.progressionPct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.min(100, params.progressionPct)}%;"></div>
        </div>
        <div style="font-size: 12px; color: #5C6789;">Objectif : ${fmtXOF(params.targetAmountXOF)} ${params.monthlyContribXOF ? `• Contribution mensuelle : ${fmtXOF(params.monthlyContribXOF)}` : ''}</div>
      </div>
      ` : ''}
    </div>

    <!-- POSITIONS -->
    ${params.positions.length > 0 ? `
    <div class="section">
      <div class="section-title">💼 Mes positions (${params.positions.length})</div>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th style="text-align: right;">Qté</th>
            <th style="text-align: right;">Rendement</th>
            <th style="text-align: right;">Gain/Perte</th>
            <th style="text-align: center;">Signal</th>
          </tr>
        </thead>
        <tbody>${positionsRows}</tbody>
      </table>
    </div>
    ` : '<div class="section" style="color: #8B95B0; font-size: 14px;">Aucune position ouverte dans votre portefeuille.</div>'}

    <!-- ACTUALITÉS BRVM -->
    ${params.news.length > 0 ? `
    <div class="section">
      <div class="section-title">📰 Top 10 actualités BRVM de la semaine</div>
      <div>${newsRows}</div>
    </div>
    ` : ''}

    <div style="text-align: center; padding: 24px 32px 16px;">
      <a href="${APP_URL}/portfolio" class="button">Voir mon portefeuille complet</a>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} ${APP_NAME} — Analyses BRVM premium</p>
      <p>Vous recevez cet email hebdomadaire car vous êtes abonné à BRVM Analyzer.</p>
      <p>Source des actualités : sikafinance.com</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textPositions = params.positions.map(p =>
    `  ${p.ticker.toUpperCase()} (${p.name}) — Qté: ${p.quantity} — ${fmtPct(p.grossYieldPct)} — ${fmtXOF(p.gainXOF)} — ${p.recommandation}`
  ).join('\n');

  const textNews = params.news.slice(0, 10).map((n, i) =>
    `  ${i + 1}. [${n.category}] ${n.title}\n     ${n.url}`
  ).join('\n');

  const text = `Bonjour ${prenom},

BILAN HEBDOMADAIRE — Semaine du ${params.weekOf}

═══ RÉSUMÉ DU PORTEFEUILLE ═══
Valeur actuelle : ${fmtXOF(params.totalCurrentValueXOF)}
Gain / Perte : ${fmtXOF(params.totalGainXOF)}
Rendement global : ${fmtPct(params.totalGrossYieldPct)}
${params.progressionPct !== null ? `Progression vers l'objectif : ${params.progressionPct}%` : ''}

═══ MES POSITIONS ═══
${textPositions || 'Aucune position ouverte.'}

═══ TOP 10 ACTUALITÉS BRVM ═══
${textNews || 'Aucune actualité disponible.'}

Accéder à mon portefeuille : ${APP_URL}/portfolio

© ${new Date().getFullYear()} ${APP_NAME}`;

  return { subject, html, text };
}

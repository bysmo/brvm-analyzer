# BRVM Analyzer — Guide Technique Complet

Ce document détaille tous les concepts techniques, packages et architectures utilisés dans l'application BRVM Analyzer. Il est conçu pour vous permettre de prendre la main sur le code et de faire évoluer le projet.

---

## Sommaire

1. [Vue d'ensemble de la stack](#1-vue-densemble-de-la-stack)
2. [TypeScript (.ts, .tsx)](#2-typescript-ts-tsx)
3. [Next.js 16 et l'App Router](#3-nextjs-16-et-lapp-router)
4. [Bun vs npm — Pourquoi npm](#4-bun-vs-npm--pourquoi-npm)
5. [Prisma ORM](#5-prisma-orm)
6. [Authentification JWT + bcryptjs](#6-authentification-jwt--bcryptjs)
7. [Nodemailer (envoi d'emails)](#7-nodemailer-envoi-demails)
8. [NextAuth — Pourquoi nous ne l'utilisons pas](#8-nextauth--pourquoi-nous-ne-lutilisons-pas)
9. [Stripe (paiement VISA 3DS)](#9-stripe-paiement-visa-3ds)
10. [Orange Money API](#10-orange-money-api)
11. [Tailwind CSS + shadcn/ui](#11-tailwind-css--shadcnui)
12. [Architecture du scraping sikafinance](#12-architecture-du-scraping-sikafinance)
13. [Moteur d'analyse boursière](#13-moteur-danalyse-boursière)
14. [Système d'abonnement et cron jobs](#14-système-dabonnement-et-cron-jobs)
15. [Instrumentation Next.js](#15-instrumentation-nextjs)
16. [Workflow de développement](#16-workflow-de-développement)
17. [Glossaire des packages](#17-glossaire-des-packages)

---

## 1. Vue d'ensemble de la stack

```
┌─────────────────────────────────────────────────────────┐
│                    NAVIGATEUR (CLIENT)                   │
│  React 19 + TypeScript + Tailwind CSS + shadcn/ui       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / fetch / cookies
┌────────────────────────▼────────────────────────────────┐
│              NEXT.JS 16 (App Router)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Pages /     │  │  API Routes  │  │  Server-     │  │
│  │  Composants  │  │  /api/...     │  │  Components  │  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  │
└───────────────────────────┼─────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
   ┌─────▼─────┐    ┌───────▼───────┐  ┌──────▼──────┐
   │  Prisma   │    │  Nodemailer   │  │  Stripe +   │
   │  (SQLite/ │    │  (SMTP)       │  │  Orange     │
   │  Postgres)│    │               │  │  Money APIs │
   └───────────┘    └───────────────┘  └─────────────┘
         │
   ┌─────▼─────────────────────┐
   │  r.jina.ai (scraper       │
   │  sikafinance.com)         │
   └───────────────────────────┘
```

### Versions principales
- Next.js : 16.1.1
- React : 19.0.0
- TypeScript : 5.x
- Prisma : 6.11.1
- Node.js : 18+ (testé avec 24)

---

## 2. TypeScript (.ts, .tsx)

### Qu'est-ce que TypeScript ?

TypeScript est un **sur-ensemble de JavaScript** développé par Microsoft qui ajoute un **système de types statique**. Le code TypeScript est ensuite **transpilé** (converti) en JavaScript pour être exécuté par Node.js ou le navigateur.

### Extensions de fichiers

| Extension | Usage | Exemple |
|-----------|-------|---------|
| `.ts` | Fichier TypeScript pur (logique, services, API routes) | `src/lib/auth/auth.ts` |
| `.tsx` | TypeScript + JSX (composants React avec balises HTML) | `src/components/brvm/StockDashboard.tsx` |
| `.d.ts` | Définitions de types (sans implémentation) | `next-env.d.ts` |

### Pourquoi utiliser TypeScript ?

1. **Détection d'erreurs à la compilation** : les fautes de frappe sur les noms de variables, les types incorrects, etc. sont détectées avant l'exécution.
2. **Autocomplétion intelligente** dans l'éditeur (VS Code, WebStorm).
3. **Documentation auto** : les types servent de documentation pour les fonctions.
4. **Refactoring sûr** : changer une structure de données met en évidence tous les endroits à modifier.

### Exemple concret dans le projet

```typescript
// src/lib/brvm/types.ts
export interface StockMeta {
  ticker: string;       // ex: "BOAB.bj"
  name: string;         // ex: "BANK OF AFRICA BENIN"
  isin: string;         // ex: "BJ0000000048"
  country: Country;     // type union: 'CI' | 'SN' | 'BF' | 'BJ' | 'ML' | 'NE' | 'TG'
  sector: string;
  flag: string;
}

// src/lib/brvm/stocks.ts
export function getStockByTicker(ticker: string): StockMeta | undefined {
  return BRVM_STOCKS.find(s => s.ticker.toLowerCase() === ticker.toLowerCase());
}
```

Ici, TypeScript sait que `getStockByTicker` retourne soit un `StockMeta`, soit `undefined`. L'éditeur vous proposera `.ticker`, `.name`, etc. sur le résultat (s'il n'est pas undefined).

### Configuration

Le fichier `tsconfig.json` configure le compilateur TypeScript :
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "jsx": "preserve",  // Next.js gère la transformation JSX
    "strict": true,     // mode strict (recommandé)
    "paths": { "@/*": ["./src/*"] }  // alias d'imports
  }
}
```

L'alias `@/*` permet d'écrire :
```typescript
import { db } from '@/lib/db';  // au lieu de '../../lib/db'
```

---

## 3. Next.js 16 et l'App Router

### Qu'est-ce que Next.js ?

Next.js est un **framework React** créé par Vercel qui ajoute :
- **Routage automatique** basé sur les fichiers (pas besoin de configurer react-router)
- **Server-Side Rendering (SSR)** et **Static Site Generation (SSG)**
- **API Routes** : créer un backend dans le même projet
- **Optimisations automatiques** (images, polices, code splitting)

### L'App Router (depuis Next.js 13)

Next.js 16 utilise l'**App Router** (dossier `app/`) qui remplace le Pages Router (dossier `pages/`). La structure des dossiers définit les routes :

```
src/app/
├── layout.tsx              → Layout racine (HTML, body, footer)
├── page.tsx                → Route "/" (page d'accueil)
├── globals.css             → Styles globaux
├── (auth)/                 → Route Group (parenthèses = ne fait pas partie de l'URL)
│   ├── login/page.tsx      → Route "/login"
│   ├── register/page.tsx   → Route "/register"
│   ├── pricing/page.tsx    → Route "/pricing"
│   ├── checkout/[planId]/  → Route dynamique "/checkout/1mois"
│   ├── validate/[token]/   → Route dynamique "/validate/abc123"
│   └── account/page.tsx    → Route "/account"
├── api/                    → API Routes (backend)
│   ├── auth/
│   │   ├── register/route.ts   → POST /api/auth/register
│   │   ├── login/route.ts      → POST /api/auth/login
│   │   ├── logout/route.ts     → POST /api/auth/logout
│   │   ├── me/route.ts         → GET /api/auth/me
│   │   ├── validate/[token]/route.ts
│   │   ├── validate-otp/route.ts
│   │   └── resend-otp/route.ts
│   ├── brvm/
│   │   ├── list/route.ts
│   │   ├── rankings/route.ts
│   │   ├── analyze/[ticker]/route.ts
│   │   ├── sector-comparison/[ticker]/route.ts
│   │   └── recommendations/route.ts
│   ├── payments/
│   │   ├── orange-money/initiate/route.ts
│   │   ├── orange-money/confirm/route.ts
│   │   ├── visa/create-intent/route.ts
│   │   └── visa/confirm/route.ts
│   └── subscriptions/
│       ├── plans/route.ts
│       └── check/route.ts
```

### 'use client' vs 'use server'

Next.js distingue :
- **Server Components** (par défaut) : exécutés sur le serveur, pas de JavaScript envoyé au client
- **Client Components** (marqués `'use client'`) : exécutés dans le navigateur, peuvent utiliser `useState`, `useEffect`, etc.

```typescript
// src/components/brvm/StockDashboard.tsx
'use client';  // ← Cette directive en haut du fichier

import { useState, useEffect } from 'react';

export function StockDashboard() {
  const [data, setData] = useState(null);  // possible car 'use client'
  // ...
}
```

### API Routes

Chaque fichier `route.ts` dans `app/api/` expose des handlers HTTP :

```typescript
// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';  // ne jamais mettre en cache

export async function POST(request: Request) {
  const body = await request.json();
  // ... logique
  return NextResponse.json({ success: true, user, token });
}
```

Les méthodes HTTP supportées : `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.

---

## 4. Bun vs npm — Pourquoi npm

### Qu'est-ce que Bun ?

**Bun** est un runtime JavaScript alternatif à Node.js, créé en 2022 par Jarred Sumner. Il est :
- Plus rapide que Node.js (écrit en Zig)
- Inclut un gestionnaire de paquets (`bun install`), un bundler, un test runner
- Compatible avec la plupart des packages npm

### Pourquoi nous utilisons npm

Dans l'environnement sandbox de développement, Bun était pré-installé et utilisé par défaut. Cependant :

1. **Vous êtes sur macOS avec Node.js 24** → npm est déjà disponible
2. **Bun peut poser des problèmes de compatibilité** sur certains environnements
3. **npm est universel** et bien documenté

### Équivalences de commandes

| Action | Avec Bun | Avec npm |
|--------|----------|----------|
| Installer les dépendances | `bun install` | `npm install` |
| Ajouter un package | `bun add stripe` | `npm install stripe` |
| Ajouter un package dev | `bun add -D @types/x` | `npm install -D @types/x` |
| Lancer le serveur dev | `bun run dev` | `npm run dev` |
| Lancer le linter | `bun run lint` | `npm run lint` |
| Push le schéma Prisma | `bun run db:push` | `npx prisma db push` |

### Le fichier `bun.lock`

Le fichier `bun.lock` est l'équivalent de `package-lock.json` pour Bun. Il verrouille les versions exactes des dépendances. **Avec npm, ce fichier est ignoré** et npm génère son propre `package-lock.json`.

Vous pouvez donc :
- Soit garder `bun.lock` dans le projet (il ne gêne pas npm)
- Soit le supprimer si vous n'utiliserez jamais Bun

---

## 5. Prisma ORM

### Qu'est-ce que Prisma ?

**Prisma** est un ORM (Object-Relational Mapping) moderne pour Node.js/TypeScript. Il remplace les requêtes SQL brutes par une API TypeScript type-safe.

### Avantages par rapport à SQL brut

```typescript
// ❌ SQL brut (sécurité, types, etc. à gérer manuellement)
const result = await db.query('SELECT * FROM User WHERE email = ?', [email]);

// ✅ Avec Prisma
const user = await db.user.findUnique({ where: { email } });
// user est automatiquement typé comme User | null
```

### Le schéma Prisma

Le fichier `prisma/schema.prisma` définit la structure de la base :

```prisma
// Générateur (ne pas modifier)
generator client {
  provider = "prisma-client-js"
}

// Source de données
datasource db {
  provider = "sqlite"                              // ou "postgresql"
  url      = env("DATABASE_URL")                   // lit depuis .env
}

// Modèle User
model User {
  id            String   @id @default(cuid())      // ID auto-généré (cuid)
  email         String   @unique                   // champ unique
  passwordHash  String
  firstName     String?
  lastName      String?
  role          String   @default("user")          // valeur par défaut
  emailValidated Boolean @default(false)
  emailValidationOtp    String?                    // ? = nullable
  
  createdAt     DateTime @default(now())           // auto à la création
  updatedAt     DateTime @updatedAt                // auto à chaque update

  // Relations
  subscriptions Subscription[]                     // one-to-many
  sessions      Session[]
  payments      Payment[]
}

// Une session appartient à un User (relation inverse)
model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  expiresAt    DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])                                // index pour perf
  @@index([token])
}
```

### Annotations importantes

| Annotation | Signification |
|------------|---------------|
| `@id` | Clé primaire |
| `@default(cuid())` | Génère un ID unique automatiquement |
| `@unique` | Valeur unique (pas de doublons) |
| `?` (après le type) | Champ nullable (peut être null) |
| `@default(now())` | Date de création auto |
| `@updatedAt` | Date de modification auto |
| `@relation(...)` | Définit une relation entre tables |
| `onDelete: Cascade` | Si le parent est supprimé, les enfants aussi |
| `@@index([field])` | Crée un index pour accélérer les requêtes |

### Commandes Prisma essentielles

```bash
# 1. Pousser le schéma en base (crée/modifie les tables)
npx prisma db push

# 2. Régénérer le client Prisma (après modif du schema)
npx prisma generate

# 3. Ouvrir Prisma Studio (interface visuelle de la BDD)
npx prisma studio

# 4. Créer une migration (en production avec PostgreSQL)
npx prisma migrate dev --name nom_migration
```

### Le client Prisma

Le fichier `src/lib/db.ts` exporte une instance unique du client :

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

Le pattern `globalForPrisma` évite d'ouvrir trop de connexions en mode développement (Next.js recharge les modules à chaud).

### Exemples de requêtes Prisma

```typescript
import { db } from '@/lib/db';

// CREATE
const user = await db.user.create({
  data: { email: 'test@test.com', passwordHash: '...', role: 'user' }
});

// READ (un seul)
const user = await db.user.findUnique({ where: { email: 'test@test.com' } });

// READ (plusieurs avec filtre)
const activeSubs = await db.subscription.findMany({
  where: { status: 'active', endDate: { gt: new Date() } },
  orderBy: { endDate: 'desc' },
  include: { user: true }  // jointure
});

// UPDATE
await db.user.update({
  where: { id: userId },
  data: { emailValidated: true }
});

// UPDATE (en masse)
await db.subscription.updateMany({
  where: { status: 'active', endDate: { lt: new Date() } },
  data: { status: 'expired' }
});

// DELETE
await db.session.deleteMany({ where: { token } });
```

---

## 6. Authentification JWT + bcryptjs

### Architecture d'authentification

Nous avons construit notre **propre système d'authentification** (sans NextAuth) avec :

1. **bcryptjs** : hachage sécurisé des mots de passe
2. **jsonwebtoken** : génération de tokens JWT pour les sessions
3. **Prisma** : stockage des utilisateurs et sessions en base

### bcryptjs — Hachage des mots de passe

**NE JAMAIS stocker un mot de passe en clair**. On utilise une fonction de hachage à sens unique avec un "salt" (sel) :

```typescript
import bcrypt from 'bcryptjs';

// Hachage (à l'inscription)
const salt = await bcrypt.genSalt(10);          // 10 = coût (plus élevé = plus sûr)
const hash = await bcrypt.hash('monpassword', salt);
// hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Vérification (à la connexion)
const valid = await bcrypt.compare('monpassword', hash);  // true/false
```

### jsonwebtoken (JWT) — Sessions

Un **JSON Web Token** est un token encodé (pas chiffré) qui contient des claims (données). Il est signé avec un secret pour empêcher la falsification.

**Structure d'un JWT** : `header.payload.signature`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;  // secret partagé

// Génération (à la connexion)
const token = jwt.sign(
  { userId: '123', iat: Date.now() },      // payload
  JWT_SECRET,
  { expiresIn: '30d' }                      // options
);

// Vérification (à chaque requête)
const payload = jwt.verify(token, JWT_SECRET);  // { userId: '123', iat: ..., exp: ... }
```

### Workflow complet d'authentification

```
INSCRIPTION                           CONNEXION                        REQUÊTE AUTHENTIFIÉE
─────────────                         ─────────                        ──────────────────────
1. User remplit le form               1. User saisit email + mdp       1. Client envoie cookie
2. POST /api/auth/register            2. POST /api/auth/login             brvm_session=token
3. bcrypt.hash(mdp)                   3. db.user.findUnique(email)     2. Server lit le cookie
4. db.user.create(...)                4. bcrypt.compare(mdp, hash)     3. jwt.verify(token)
5. Génère OTP 6 chiffres              5. Si OK: jwt.sign({userId})     4. db.session.findUnique
6. Envoie email avec OTP              6. db.session.create(token)      5. Vérifie expiresAt
7. User reçoit OTP                    7. Set cookie brvm_session       6. Vérifie abonnement actif
8. POST /api/auth/validate-otp        8. Return user + token           7. Retourne SessionUser
9. db.user.update(emailValidated=true)
```

### Le fichier `src/lib/auth/auth.ts`

Fonctions clés :
- `hashPassword(password)` → hash bcrypt
- `verifyPassword(password, hash)` → bool
- `generateEmailValidationToken()` → { token, otp, expiresAt }
- `generateSessionToken(userId)` → JWT string
- `verifySessionToken(token)` → { userId } | null
- `createUser(params)` → crée un user en base
- `authenticateUser(email, password)` → login
- `validateEmailByOtp(email, otp)` → valide le compte
- `getUserFromRequest(request)` → récupère l'utilisateur depuis une requête HTTP

---

## 7. Nodemailer (envoi d'emails)

### Qu'est-ce que Nodemailer ?

**Nodemailer** est la bibliothèque standard pour envoyer des emails en Node.js. Elle supporte SMTP, sendmail, et divers services (Gmail, Outlook, etc.).

### Configuration

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',     // serveur SMTP
  port: 587,                   // 587 = TLS, 465 = SSL
  secure: false,               // true pour port 465
  auth: {
    user: 'vous@gmail.com',
    pass: 'motdepasse_app',    // mot de passe d'application
  },
});

await transporter.sendMail({
  from: '"BRVM Analyzer" <noreply@brvm-analyzer.com>',
  to: 'user@example.com',
  subject: 'Votre code OTP',
  html: '<h1>Code: 123456</h1>',
  text: 'Code: 123456',  // version texte pur (fallback)
});
```

### Mode démo (sans SMTP)

Dans notre projet, si `SMTP_HOST` n'est pas configuré, les emails sont **loggés dans la console** au lieu d'être envoyés :

```typescript
function getTransporter() {
  if (!SMTP_HOST) return null;  // mode démo
  // ... configure nodemailer
}
```

### Templates d'emails

Les templates sont des fonctions qui retournent du HTML + texte :

```typescript
export function emailValidationTemplate(params: {
  firstName: string | null;
  email: string;
  validationUrl: string;
  otp: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: 'BRVM Analyzer - Votre code de validation',
    html: `<html>...code HTML avec style inline...</html>`,
    text: 'Version texte pur pour les clients mail qui ne supportent pas HTML',
  };
}
```

### Services SMTP courants

| Service | Host | Port | Notes |
|---------|------|------|-------|
| Gmail | smtp.gmail.com | 587 | Mot de passe d'app requis |
| Outlook/Hotmail | smtp-mail.outlook.com | 587 | |
| Brevo (Sendinblue) | smtp-relay.brevo.com | 587 | 300 emails/jour gratuits |
| SendGrid | smtp.sendgrid.net | 587 | Clé API comme mot de passe |
| Mailgun | smtp.mailgun.org | 587 | |

---

## 8. NextAuth — Pourquoi nous ne l'utilisons pas

### Qu'est-ce que NextAuth (Auth.js) ?

**NextAuth.js** (devenu **Auth.js**) est la solution d'authentification officielle pour Next.js. Elle gère :
- OAuth (Google, GitHub, Facebook, etc.)
- Email magic links
- Credentials (email + mot de passe)
- Sessions via JWT ou base de données

### Pourquoi nous l'avons retiré

Le projet incluait initialement `next-auth@4.24.11` mais **aucun code ne l'utilisait**. Nous avons construit notre propre système d'authentification pour plusieurs raisons :

1. **Conflit de dépendances** : `next-auth@4` exige `nodemailer@^7` en peer dependency, mais nous utilisions `nodemailer@^9`
2. **Besoin de contrôle total** : le système d'OTP, la validation par email, les sessions en base, etc. sont plus simples à implémenter soi-même
3. **NextAuth v4 est anciennement mature mais v5 (Auth.js) est encore beta** pour l'App Router

### Comparaison

| Critère | Notre système | NextAuth |
|---------|---------------|----------|
| Code à maintenir | ~300 lignes | Configuration minimale |
| Flexibilité | Totale | Limitée aux providers |
| OAuth social | À implémenter | Natif (Google, GitHub, etc.) |
| Magic links | À implémenter | Natif |
| Sessions | Base + JWT | JWT ou base |
| Courbe d'apprentissage | Faible (code standard) | Moyenne (config spécifique) |

### Si vous voulez ajouter NextAuth plus tard

```bash
npm install next-auth@beta
```

Et configurer `src/app/api/auth/[...nextauth]/route.ts` :
```typescript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      // ...
    }),
  ],
});

export { handler as GET, handler as POST };
```

---

## 9. Stripe (paiement VISA 3DS)

### Qu'est-ce que Stripe ?

**Stripe** est la plateforme de paiement la plus populaire pour le web. Elle gère :
- Cartes VISA, Mastercard, Amex
- 3D Secure (authentification forte obligatoire en UE)
- Webhooks pour confirmer les paiements
- Conformité PCI-DSS (vous ne stockez jamais les numéros de carte)

### Concept de PaymentIntent

Le flux Stripe repose sur un **PaymentIntent** :

```
1. Client clique sur "Payer"
   ↓
2. Serveur crée un PaymentIntent (POST /api/payments/visa/create-intent)
   → Stripe retourne un client_secret
   ↓
3. Client saisit sa carte → Stripe.confirmpayment(clientSecret, card)
   → Si 3DS requis: redirection vers la banque
   ↓
4. Client valide 3DS sur le site de sa banque
   ↓
5. Stripe confirme le paiement (webhook ou polling)
   ↓
6. Serveur active l'abonnement
```

### Code Stripe dans le projet

```typescript
// src/lib/payment/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Créer un PaymentIntent
const intent = await stripe.paymentIntents.create({
  amount: 5000,                    // 5000 XOF (XOF = pas de décimales)
  currency: 'xof',
  description: 'Abonnement BRVM 1 mois',
  receipt_email: 'user@example.com',
  metadata: { internalPaymentId: '...' },
  payment_method_options: {
    card: { request_three_d_secure: 'automatic' },  // 3DS auto
  },
  automatic_payment_methods: { enabled: true },
});

// Vérifier le statut
const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
if (intent.status === 'succeeded') { /* activer abonnement */ }
```

### Mode test vs production

| Mode | Clé secrète | Carte test |
|------|-------------|------------|
| Test | `sk_test_...` | `4242 4242 4242 4242` (toujours réussi) |
| Live | `sk_live_...` | Vraies cartes |

### Webhooks (pour la production)

En production, Stripe envoie des webhooks pour confirmer les paiements asynchrones :

```typescript
// src/app/api/payments/stripe-webhook/route.ts
import Stripe from 'stripe';

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  const event = Stripe.webhooks.constructEvent(
    body, sig, process.env.STRIPE_WEBHOOK_SECRET
  );
  
  if (event.type === 'payment_intent.succeeded') {
    // activer l'abonnement
  }
  
  return NextResponse.json({ received: true });
}
```

---

## 10. Orange Money API

### Qu'est-ce que l'API Orange Money ?

Orange propose une API officielle pour le paiement marchand dans 5 pays UEMOA :
- Côte d'Ivoire (CI)
- Sénégal (SN)
- Burkina Faso (BF)
- Mali (ML)
- Bénin (BJ)

### Workflow Orange Money Web Payment

```
1. Client choisit Orange Money + son pays
   ↓
2. Serveur obtient un token OAuth2 (client_id + client_secret)
   ↓
3. Serveur crée une transaction (POST /webpayment)
   → Orange retourne une payment_url
   ↓
4. Client est redirigé vers payment_url (page Orange Money)
   ↓
5. Client valide avec son code secret Orange Money
   ↓
6. Orange redirige vers notre URL de callback
   ↓
7. Serveur vérifie le statut (GET /webpayment/{txn_id})
   ↓
8. Si SUCCESS: activer l'abonnement
```

### Mode sandbox vs production

| Mode | Comment | Comportement |
|------|---------|--------------|
| Sandbox (défaut) | `ORANGE_MONEY_ENV=sandbox` ou pas de clés | Paiement simulé, OTP fictif accepté |
| Production | `ORANGE_MONEY_ENV=production` + clés API | Vraies transactions |

### Configuration par pays

Chaque pays a ses propres clés API Orange :

```bash
# .env
ORANGE_MONEY_CLIENT_ID_CI=xxx
ORANGE_MONEY_CLIENT_SECRET_CI=xxx
ORANGE_MONEY_MERCHANT_NUMBER_CI=xxx

ORANGE_MONEY_CLIENT_ID_SN=xxx
# ... idem pour SN, BF, ML, BJ
```

### Obtenir les clés API Orange

1. Aller sur https://developer.orange.com/
2. Créer une application
3. Souscrire à l'API "Orange Money Web Payment"
4. Récupérer `client_id` et `client_secret` par pays
5. Le `merchant_number` est votre numéro marchand Orange Money

---

## 11. Tailwind CSS + shadcn/ui

### Tailwind CSS 4

**Tailwind CSS** est un framework CSS **utility-first**. Au lieu d'écrire du CSS traditionnel, on compose des classes utilitaires :

```html
<!-- Au lieu de: <div class="card"> -->
<div class="bg-brvm-card border border-brvm-border rounded-lg p-4 hover:border-brvm-accent transition-colors">
  Contenu
</div>
```

### Configuration Tailwind

Le fichier `tailwind.config.ts` étend Tailwind avec nos couleurs custom :

```typescript
const config = {
  theme: {
    extend: {
      colors: {
        brvm: {
          bg: '#0A0E1A',
          card: '#161D33',
          accent: '#00D678',
          danger: '#FF4757',
          // ...
        }
      }
    }
  }
}
```

Mais dans Tailwind 4, on définit surtout les couleurs via des variables CSS dans `globals.css` :

```css
@theme inline {
  --color-brvm-bg: #0A0E1A;
  --color-brvm-accent: #00D678;
}

.bg-brvm-bg { background-color: var(--color-brvm-bg); }
```

### shadcn/ui

**shadcn/ui** n'est pas une bibliothèque npm traditionnelle. C'est une collection de **composants React copiables** basés sur Radix UI.

Au lieu d'installer un package, vous copiez le code source du composant dans votre projet (`src/components/ui/`). Cela permet :
- Personnalisation totale (vous possédez le code)
- Pas de dépendance lourde
- Style cohérent avec Tailwind

Exemples de composants dans le projet :
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/dropdown-menu.tsx`

### Ajouter un nouveau composant shadcn

```bash
npx shadcn-ui@latest add tooltip
# ou avec la nouvelle CLI
npx shadcn@latest add tooltip
```

---

## 12. Architecture du scraping sikafinance

### Le problème

Le site `sikafinance.com` est protégé par **Cloudflare** qui bloque les requêtes provenant de bots (curl, fetch direct → HTTP 403).

### La solution : r.jina.ai

**r.jina.ai** est un service de "reader" qui :
1. Charge la page avec un vrai navigateur headless
2. Contourne Cloudflare
3. Retourne le contenu en markdown

```typescript
// src/lib/brvm/scraper.ts
async function fetchMarkdown(url: string): Promise<string> {
  const fullUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(fullUrl, {
    headers: { 'Accept': 'application/json' },
  });
  const json = await res.json();
  return json?.data?.content || '';  // markdown
}
```

### Sources de données

| Source | URL | Données récupérées |
|--------|-----|-------------------|
| Liste A-Z | `/markets/aaz` | Cours, volumes, variations pour toutes les actions |
| Page société | `/markets/societe/{ticker}` | Actionnaires, fondamentaux 5 ans, infos société |

### Parsing du markdown

Le markdown est ensuite parsé avec des expressions régulières :

```typescript
// Extraire un nombre français: "9 025" → 9025
function parseFrNumber(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.'));
}

// Trouver les actionnaires: "BOA WEST AFRICA*54,11;DIVERS..."
const shRawMatch = md.match(/Principaux actionnaires\s*\n+([A-Z][^\n]*)/i);
```

### Cache en mémoire

Pour éviter de re-scrapper à chaque requête, on met en cache 30 minutes :

```typescript
const CACHE: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30 * 60 * 1000;  // 30 min

export async function fetchStockData(ticker: string) {
  const cached = CACHE[ticker];
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;  // retourne le cache
  }
  // ... sinon fetch + parse + cache
}
```

---

## 13. Moteur d'analyse boursière

### Architecture

```
src/lib/brvm/
├── stocks.ts       → Liste des 48 actions BRVM + Top 30 liquides
├── types.ts        → Types TypeScript (StockData, Analysis, etc.)
├── scraper.ts      → Scraping sikafinance via r.jina.ai
└── analyzer.ts     → Moteur de scoring
```

### Les 4 scores d'analyse

#### 1. Score de liquidité (0-100)

| Composant | Max points | Logique |
|-----------|------------|---------|
| Volume jour (titres) | 25 | >100k=25, >10k=18, >1k=10, >100=4 |
| Volume XOF | 25 | >500M=25, >100M=18, >20M=10, >2M=4 |
| Capital échangé % | 20 | >0.5%=20, >0.1%=15, >0.02%=7 |
| Top 30 BRVM | 30 | Présent=30, absent=0 |

#### 2. Score fondamentaux (0-100)

Vérifie sur 5 ans :
- **CA croissant** : 35 pts (strict=35, global=22, non=5)
- **Résultat Net croissant** : 35 pts (idem)
- **Dividendes croissants** : 30 pts (idem)

#### 3. Score dynamisme (0-100)

- **BNPA** : 25 pts si en hausse sur 5 ans
- **PER** : 40 pts (15 absolu + 15 vs secteur + 10 tendance 5 ans)
- **DPA** : 35 pts (selon comparaison vs moyenne sectorielle)

#### 4. Verdict global (0-100)

```
Score global = Liquidité × 0.25 + Fondamentaux × 0.35 + Dynamisme × 0.30 + (100 - %étrangers) × 0.10
```

Avec pénalités :
- PER très élevé + sur-coté : -20 à -25 pts
- PER bas + sous-coté + décroissant : +8 à +12 pts

Recommandation finale :
- ≥75 → ACHAT
- ≥55 → CONSERVER
- ≥35 → OBSERVER
- <35 → VENDRE

### Moyennes sectorielles

Pour comparer une action à son secteur, on pré-charge les 15 actions les plus liquides et on calcule la moyenne du PER et du DPA par secteur. Le résultat est mis en cache 1 heure.

---

## 14. Système d'abonnement et cron jobs

### Modèle de données

```prisma
model Subscription {
  userId          String
  planId          String       // "1mois" | "3mois" | ...
  startDate       DateTime
  endDate         DateTime     // calculée: startDate + durationMonths
  status          String       // "active" | "expired" | "cancelled"
  paymentId       String?
}

model Payment {
  userId          String
  amountXOF       Int
  method          String       // "orange_money" | "visa_3ds"
  status          String       // "pending" | "succeeded" | "failed"
  providerPaymentId String?    // ID chez Orange/Stripe
}
```

### Activation d'abonnement

```typescript
// src/lib/payment/subscription.ts
export async function activateSubscription(params) {
  // 1. Désactiver les abonnements actifs précédents
  await db.subscription.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'expired' },
  });
  
  // 2. Créer le nouvel abonnement
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + plan.durationMonths);
  
  const subscription = await db.subscription.create({
    data: { ...startDate: new Date(), endDate, status: 'active' },
  });
  
  // 3. Mettre à jour le paiement
  await db.payment.update({ where: { id: paymentId }, data: { status: 'succeeded' } });
  
  // 4. Envoyer email de confirmation
  await sendEmail({ ... });
  
  return { success: true, subscriptionId, endDate };
}
```

### Désactivation automatique (cron job)

```typescript
// src/app/api/cron/expire-subscriptions/route.ts
export async function GET(request: Request) {
  // Sécurité par secret partagé
  const cronSecret = request.headers.get('X-Cron-Secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  
  // Désactive tous les abonnements expirés
  const result = await db.subscription.updateMany({
    where: { status: 'active', endDate: { lt: new Date() } },
    data: { status: 'expired' },
  });
  
  return NextResponse.json({ expiredCount: result.count });
}
```

### En production : configurer un cron job

**Vercel** (si vous déployez sur Vercel) :
```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/expire-subscriptions", "schedule": "0 * * * *" }
  ]
}
```

**Cron classique** (Linux/macOS) :
```bash
# crontab -e
0 * * * * curl -H "X-Cron-Secret: votre-secret" https://votre-domaine.com/api/cron/expire-subscriptions
```

---

## 15. Instrumentation Next.js

### Qu'est-ce que l'instrumentation ?

Next.js 14+ supporte un fichier `instrumentation.ts` à la racine de `src/` qui s'exécute **une fois au démarrage du serveur**. C'est l'endroit idéal pour :
- Initialiser un compte admin
- Se connecter à un service externe
- Précharger des données en cache

### Notre instrumentation

```typescript
// src/instrumentation.ts
export async function register() {
  // Ne s'exécute que côté serveur (pas dans le bundle client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureAdminUserExists } = await import('@/lib/auth/init-admin');
    await ensureAdminUserExists();
  }
}
```

### Le script `init-admin.ts`

```typescript
// src/lib/auth/init-admin.ts
export async function ensureAdminUserExists() {
  const existing = await db.user.findUnique({ where: { email: 'admin' } });
  
  if (existing) {
    // Met à jour si l'admin existe mais n'est pas configuré correctement
    if (existing.role !== 'admin') {
      await db.user.update({ where: { id: existing.id }, data: { role: 'admin', ... } });
    }
    return;
  }
  
  // Crée l'admin
  const passwordHash = await bcrypt.hash('admin', 10);
  await db.user.create({
    data: {
      email: 'admin',
      passwordHash,
      firstName: 'Admin',
      lastName: 'BRVM',
      role: 'admin',
      emailValidated: true,  // l'admin n'a pas besoin de valider son email
    },
  });
}
```

---

## 16. Workflow de développement

### Commandes utiles

```bash
# Démarrer le serveur dev (hot reload)
npm run dev

# Lancer le linter
npm run lint

# Pousser le schéma Prisma en base
npx prisma db push

# Régénérer le client Prisma
npx prisma generate

# Ouvrir Prisma Studio (interface visuelle BDD)
npx prisma studio
# → http://localhost:5555

# Build de production
npm run build

# Démarrer en production
npm run start
```

### Structure d'une nouvelle fonctionnalité

Pour ajouter une nouvelle page + API :

1. **Créer l'API route** : `src/app/api/ma-feature/route.ts`
2. **Créer la logique métier** : `src/lib/ma-feature/service.ts`
3. **Créer le composant UI** : `src/components/ma-feature/MyComponent.tsx`
4. **Créer la page** : `src/app/(auth)/ma-feature/page.tsx`
5. **Ajouter au menu** : éditer `src/app/page.tsx`

### Debug

- **Logs serveur** : `dev.log` (ou la console où tourne `npm run dev`)
- **Logs navigateur** : DevTools F12 → Console
- **Base de données** : `npx prisma studio`
- **Erreurs 500** : vérifier `dev.log` pour la stack trace

---

## 17. Glossaire des packages

### Dépendances principales (`dependencies`)

| Package | Version | Rôle |
|---------|---------|------|
| `next` | ^16.1.1 | Framework React (App Router, API Routes, SSR) |
| `react` | ^19.0.0 | Bibliothèque UI |
| `react-dom` | ^19.0.0 | Rendu React pour le DOM |
| `@prisma/client` | ^6.11.1 | Client Prisma (généré automatiquement) |
| `prisma` | ^6.11.1 | CLI Prisma (migrations, génération) |
| `bcryptjs` | ^3.0.3 | Hachage de mots de passe (bcrypt pur JS) |
| `jsonwebtoken` | ^9.0.3 | Génération/vérification de JWT |
| `nodemailer` | ^9.0.1 | Envoi d'emails SMTP |
| `stripe` | ^22.3.0 | Client Stripe (paiements VISA 3DS) |
| `lucide-react` | ^0.525.0 | Bibliothèque d'icônes (SVG) |
| `tailwindcss` | ^4.x | Framework CSS utility-first |
| `next-themes` | ^0.4.6 | Gestion du dark/light mode |
| `next-intl` | ^4.3.4 | Internationalisation (i18n) |
| `framer-motion` | ^12.23.2 | Animations React |
| `@radix-ui/*` | * | Primitives UI accessibles (pour shadcn) |

### Dépendances de développement (`devDependencies`)

| Package | Version | Rôle |
|---------|---------|------|
| `typescript` | ^5.x | Compilateur TypeScript |
| `@types/node` | * | Types Node.js |
| `@types/react` | * | Types React |
| `@types/nodemailer` | ^8.0.1 | Types Nodemailer |
| `@types/jsonwebtoken` | ^9.0.10 | Types JWT |
| `@types/bcryptjs` | ^3.0.0 | Types bcryptjs |
| `eslint` | * | Linter JavaScript/TypeScript |
| `eslint-config-next` | * | Règles ESLint pour Next.js |

### Packages que nous avons retirés

| Package | Raison du retrait |
|---------|-------------------|
| `next-auth` | Non utilisé, conflit avec nodemailer@9 |

---

## Pour aller plus loin

### Ressources officielles

- **Next.js docs** : https://nextjs.org/docs
- **Prisma docs** : https://www.prisma.io/docs
- **Stripe docs** : https://stripe.com/docs
- **Orange Money API** : https://developer.orange.com/apis/om-core-api
- **Nodemailer** : https://nodemailer.com/
- **Tailwind CSS** : https://tailwindcss.com/docs
- **shadcn/ui** : https://ui.shadcn.com/

### Améliorations possibles

1. **OAuth social** : ajouter Google/GitHub login avec NextAuth
2. **Webhooks Stripe** : implémenter `/api/payments/stripe-webhook`
3. **Email templates** : utiliser React Email pour des templates plus riches
4. **Tests** : ajouter Jest/Vitest pour les tests unitaires
5. **Monitoring** : intégrer Sentry pour le suivi d'erreurs
6. **PWA** : transformer en Progressive Web App (offline)
7. **Mobile** : wrapper avec Capacitor pour iOS/Android
8. **Notifications** : alertes par email/SMS sur seuils de prix

---

*Document généré le 1er juillet 2026 — BRVM Analyzer v1.0*

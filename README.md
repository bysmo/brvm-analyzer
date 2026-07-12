# BRVM Analyzer - Guide d'installation

Application web d'analyse des actions cotées à la BRVM (Bourse Régionale des Valeurs Mobilières) avec système d'abonnement premium.

## Fonctionnalités

### Analyse BRVM
- Analyse de 48 actions cotées à la BRVM (8 pays UEMOA)
- Scraping temps réel via sikafinance.com (cache 30 min)
- Score de liquidité (volume jour, volume XOF, capital échangé, Top 30 BRVM)
- Analyse des fondamentaux 5 ans (CA, RN, dividendes)
- Analyse du dynamisme (BNPA, PER vs secteur, DPA vs secteur)
- Tableau de bord Recommandations (Top 5 achats / Top 5 ventes)
- Comparaison sectorielle temps réel
- Comparaison côte à côte de 4 actions

### Authentification & Abonnement
- Inscription avec validation par code OTP (6 chiffres, valable 24h)
- Connexion sécurisée (JWT + bcrypt + sessions en base)
- 4 plans d'abonnement : 1 mois (5 000 XOF), 3 mois (12 000 XOF), 6 mois (22 000 XOF), 12 mois (40 000 XOF)
- Paiement Orange Money (5 pays UEMOA : CI, SN, BF, ML, BJ)
- Paiement VISA/Mastercard 3D Secure (Stripe)
- Désactivation automatique à l'échéance (cron job)
- Email de confirmation d'abonnement

### Compte admin
- Compte admin créé automatiquement au démarrage
- Identifiants : `admin` / `admin`
- Accès illimité à toutes les fonctionnalités sans abonnement

## Stack technique

- **Framework** : Next.js 16 (App Router) + TypeScript 5
- **Style** : Tailwind CSS 4 + shadcn/ui
- **Base de données** : SQLite (dev) / PostgreSQL (prod) via Prisma ORM
- **Auth** : JWT + bcryptjs
- **Email** : Nodemailer (SMTP)
- **Paiement** : Orange Money API + Stripe (VISA 3DS)
- **Runtime** : Node.js 18+ (avec npm)

## Installation

### 1. Prérequis
- Node.js 18+ (testé avec Node.js 24)
- npm

### 2. Installation des dépendances
```bash
cd my-project
npm install
```

> ⚠️ Si vous obtenez une erreur `ERESOLVE` (conflit de peer dependencies), utilisez :
> ```bash
> npm install --legacy-peer-deps
> ```

### 3. Configuration
Le fichier `.env` est pré-configuré pour le mode démo. Pour la production, éditez :

```bash
# Base de données (SQLite par défaut, PostgreSQL en prod)
DATABASE_URL=file:./db/custom.db
# Pour PostgreSQL:
# DATABASE_URL=postgresql://user:pass@localhost:5432/brvm

# JWT secret (CHANGEZ EN PRODUCTION)
JWT_SECRET=admin

# URL de l'application
APP_URL=http://localhost:3000

# Email SMTP (laisser vide pour le mode démo = email loggé dans la console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@brvm-analyzer.com

# Orange Money (sandbox par défaut)
ORANGE_MONEY_ENV=sandbox
ORANGE_MONEY_CLIENT_ID_CI=
ORANGE_MONEY_CLIENT_SECRET_CI=
# ... (idem pour SN, BF, ML, BJ)

# Stripe (VISA 3DS)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
```

### 4. Base de données
```bash
npx prisma db push
```

Cette commande :
- Crée le fichier SQLite `db/custom.db` s'il n'existe pas
- Crée toutes les tables définies dans `prisma/schema.prisma` (User, Session, Subscription, Payment, OrangeMoneyPayment)
- Génère le client Prisma dans `node_modules/@prisma/client`

### 5. Démarrage
```bash
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

Au premier démarrage, le compte admin est automatiquement créé via `instrumentation.ts` :
- Email : `admin`
- Mot de passe : `admin`

Si pour une raison quelconque l'admin n'est pas créé automatiquement, ouvrez dans votre navigateur :
```
http://localhost:3000/api/admin/init
```
Cela créera le compte admin manuellement.

## Utilisation

### Connexion admin
1. Allez sur `http://localhost:3000/login`
2. Saisissez `admin` / `admin`
3. Vous avez accès à toutes les fonctionnalités sans abonnement

### Création d'un compte utilisateur
1. Allez sur `/register`
2. Remplissez le formulaire (email, mot de passe 8+ caractères, prénom, nom, téléphone, pays)
3. Un code OTP à 6 chiffres est envoyé par email (en mode démo, il s'affiche à l'écran)
4. Allez sur `/validate` et saisissez le code OTP pour activer votre compte
5. Connectez-vous avec vos identifiants

### Souscription d'un abonnement
1. Connectez-vous
2. Allez sur `/pricing`
3. Choisissez un plan (1, 3, 6 ou 12 mois)
4. Sélectionnez votre moyen de paiement (Orange Money ou VISA 3DS)
5. Suivez les instructions de paiement
6. Votre abonnement est actif immédiatement après le paiement

## Structure du projet

```
my-project/
├── prisma/
│   └── schema.prisma              # Schéma de base de données
├── src/
│   ├── app/
│   │   ├── (auth)/                # Pages auth (login, register, pricing, checkout, account)
│   │   │   ├── account/
│   │   │   ├── checkout/[planId]/
│   │   │   ├── login/
│   │   │   ├── pricing/
│   │   │   ├── register/
│   │   │   └── validate/
│   │   ├── api/
│   │   │   ├── admin/init/        # Init admin
│   │   │   ├── auth/              # register, login, logout, me, validate, validate-otp, resend-otp
│   │   │   ├── brvm/              # list, rankings, stock, analyze, compare, sector-comparison, recommendations
│   │   │   ├── cron/              # expire-subscriptions
│   │   │   ├── payments/          # orange-money (initiate, confirm), visa (create-intent, confirm)
│   │   │   └── subscriptions/     # plans, check
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Page d'accueil (Recommandations / Dashboard / Palmarès)
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/                  # AuthGate, UserMenu, LoginForm, RegisterForm
│   │   ├── brvm/                  # StockDashboard, RankingsTable, RecommendationsDashboard, etc.
│   │   └── ui/                    # shadcn/ui
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── auth/                  # auth.ts, init-admin.ts
│   │   ├── brvm/                  # stocks.ts, types.ts, scraper.ts, analyzer.ts
│   │   ├── email/                 # mailer.ts
│   │   ├── payment/               # plans.ts, orange-money.ts, stripe.ts, subscription.ts
│   │   ├── db.ts
│   │   └── utils.ts
│   └── instrumentation.ts         # Initialisation admin au démarrage
├── .env                           # Variables d'environnement
├── package.json
└── README.md
```

## Mode démo vs Production

### Mode démo (par défaut)
- SQLite en base de données
- Email loggé dans la console (SMTP non configuré)
- Orange Money : sandbox (OTP fictif accepté)
- Stripe : paiement simulé comme réussi

### Mode production
Pour activer le mode production, configurez dans `.env` :
- `DATABASE_URL` : URL PostgreSQL
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` : serveur SMTP réel
- `ORANGE_MONEY_ENV=production` + clés API par pays
- `STRIPE_SECRET_KEY` (sk_live_) + `STRIPE_PUBLISHABLE_KEY` (pk_live_)

## Comptes de test

### Admin
- Email : `admin`
- Mot de passe : `admin`

### Utilisateur de test
Pour créer un utilisateur de test, utilisez le formulaire `/register`. En mode démo, l'OTP s'affichera à l'écran après l'inscription.

## API endpoints

### Authentification
- `POST /api/auth/register` - Inscription (envoie OTP par email)
- `POST /api/auth/validate-otp` - Validation par code OTP
- `POST /api/auth/resend-otp` - Renvoi du code OTP
- `GET /api/auth/validate/[token]` - Validation par lien (fallback)
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Récupère l'utilisateur connecté

### Abonnements & Paiements
- `GET /api/subscriptions/plans` - Liste des plans
- `GET /api/subscriptions/check` - Vérifie l'abonnement actif
- `POST /api/payments/orange-money/initiate` - Initie paiement Orange Money
- `POST /api/payments/orange-money/confirm` - Confirme paiement Orange Money
- `POST /api/payments/visa/create-intent` - Crée PaymentIntent Stripe
- `POST /api/payments/visa/confirm` - Confirme paiement VISA

### BRVM
- `GET /api/brvm/list` - Liste des 48 actions
- `GET /api/brvm/rankings` - Palmarès temps réel
- `GET /api/brvm/stock/[ticker]` - Données d'une action
- `GET /api/brvm/analyze/[ticker]` - Analyse complète d'une action
- `POST /api/brvm/compare` - Comparaison de 2-4 actions
- `GET /api/brvm/sector-comparison/[ticker]` - Comparaison sectorielle
- `GET /api/brvm/recommendations` - Top 5 achats / Top 5 ventes

### Admin
- `GET /api/admin/init` - Initialise le compte admin manuellement

### Cron
- `GET /api/cron/expire-subscriptions` - Désactive les abonnements expirés (à appeler toutes les heures)

## Licence

Projet privé - Tous droits réservés.
# brvm-analyzer

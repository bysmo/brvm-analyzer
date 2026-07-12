/**
 * rate-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Limiteur de débit en mémoire (in-process) pour protéger les routes sensibles
 * contre les attaques par force brute.
 *
 * Usage :
 *   const result = rateLimit(key, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
 *   if (!result.allowed) return NextResponse.json({ error: result.message }, { status: 429 });
 *
 * Notes :
 *   - Adapté à un seul processus Node.js (dev & petit déploiement).
 *   - En production multi-instances, remplacer par Redis + ioredis.
 *   - La fenêtre glissante est réinitialisée après `windowMs` d'inactivité.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

// Stockage en mémoire : clé → état
const store = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées (toutes les 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      const isExpired = entry.blockedUntil
        ? now > entry.blockedUntil + CLEANUP_INTERVAL_MS
        : now > entry.firstAttemptAt + CLEANUP_INTERVAL_MS;
      if (isExpired) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Évite de bloquer l'arrêt propre du processus
  if (timer.unref) timer.unref();
}

export interface RateLimitOptions {
  /** Nombre maximum de tentatives autorisées dans la fenêtre */
  maxAttempts: number;
  /** Durée de la fenêtre de comptage (ms) */
  windowMs: number;
  /** Durée de blocage après dépassement (ms). Par défaut : égale à windowMs */
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  message: string;
}

/**
 * Vérifie et enregistre une tentative pour la clé donnée.
 * @param key  Identifiant unique (ex: `login:${ip}` ou `otp:${email}`)
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { maxAttempts, windowMs, blockDurationMs = windowMs } = options;
  const now = Date.now();

  let entry = store.get(key);

  // Entrée inexistante ou fenêtre expirée → réinitialiser
  if (!entry || (now - entry.firstAttemptAt > windowMs && !entry.blockedUntil)) {
    entry = { attempts: 0, firstAttemptAt: now, blockedUntil: null };
  }

  // Vérification si bloqué
  if (entry.blockedUntil !== null) {
    if (now < entry.blockedUntil) {
      const retryAfterMs = entry.blockedUntil - now;
      store.set(key, entry);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfterMs / 60000)} minute(s).`,
      };
    }
    // Blocage expiré → réinitialiser
    entry = { attempts: 0, firstAttemptAt: now, blockedUntil: null };
  }

  // Fenêtre glissante expirée
  if (now - entry.firstAttemptAt > windowMs) {
    entry = { attempts: 0, firstAttemptAt: now, blockedUntil: null };
  }

  // Incrémenter le compteur
  entry.attempts += 1;

  // Dépasse le seuil → bloquer
  if (entry.attempts > maxAttempts) {
    entry.blockedUntil = now + blockDurationMs;
    store.set(key, entry);
    const retryAfterMs = blockDurationMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      message: `Trop de tentatives. Compte temporairement bloqué pendant ${Math.ceil(blockDurationMs / 60000)} minute(s).`,
    };
  }

  store.set(key, entry);

  const remaining = maxAttempts - entry.attempts;
  return {
    allowed: true,
    remaining,
    retryAfterMs: 0,
    message: 'OK',
  };
}

/**
 * Réinitialise le compteur d'une clé (après succès d'authentification).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

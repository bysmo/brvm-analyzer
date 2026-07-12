/**
 * news-scraper.ts
 * ─────────────────────────────────────────────────────────────────────
 * Scraping des actualités BRVM sur sikafinance.com via r.jina.ai.
 * Retourne les 10 dernières actualités boursières.
 * ─────────────────────────────────────────────────────────────────────
 */

const READER_BASE = 'https://r.jina.ai';
const SIKA_NEWS_URL = 'https://www.sikafinance.com/marches/actualites';
const SIKA_BASE = 'https://www.sikafinance.com';

// Cache en mémoire (1 heure)
let newsCache: { items: BRVMNews[]; timestamp: number } = { items: [], timestamp: 0 };
const NEWS_CACHE_TTL = 60 * 60 * 1000; // 1h

export interface BRVMNews {
  title: string;
  summary: string;
  url: string;
  date: string;     // Date lisible (ex: "12 juillet 2026")
  source: string;   // "sikafinance.com"
  category: string; // "BRVM" | "Entreprises" | "Économie" | ...
}

/**
 * Récupère les 10 dernières actualités BRVM depuis sikafinance.com.
 * Utilise r.jina.ai pour contourner Cloudflare et obtenir du markdown.
 * Résultat mis en cache 1 heure.
 */
export async function fetchBRVMNews(forceRefresh = false): Promise<BRVMNews[]> {
  const now = Date.now();

  if (!forceRefresh && newsCache.items.length > 0 && (now - newsCache.timestamp) < NEWS_CACHE_TTL) {
    return newsCache.items;
  }

  try {
    const markdown = await fetchMarkdownFromSika(SIKA_NEWS_URL);
    const items = parseNewsMarkdown(markdown);

    if (items.length > 0) {
      newsCache = { items: items.slice(0, 10), timestamp: now };
    }

    return newsCache.items;
  } catch (err) {
    console.error('[news-scraper] Erreur lors du scraping:', err);
    // En cas d'erreur, on retourne le cache s'il existe
    return newsCache.items;
  }
}

async function fetchMarkdownFromSika(url: string): Promise<string> {
  const fullUrl = `${READER_BASE}/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown',
        'X-No-Cache': 'true',
      },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return json?.data?.content || '';
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse le markdown retourné par r.jina.ai pour extraire les actualités.
 * La page sikafinance liste les articles avec titre, résumé et lien.
 *
 * On cherche des patterns comme :
 * ## [Titre de l'article](https://...)
 * Texte de résumé...
 * _Date_ ou Date de publication
 */
function parseNewsMarkdown(markdown: string): BRVMNews[] {
  const items: BRVMNews[] = [];
  const lines = markdown.split('\n');

  // Patterns pour détecter les titres d'articles (liens markdown)
  const linkPattern = /\[([^\]]{10,200})\]\((https?:\/\/[^)]+)\)/g;

  // On collecte tous les liens qui ressemblent à des articles
  let match: RegExpExecArray | null;
  const seenUrls = new Set<string>();

  // Parcourir le markdown à la recherche de liens d'articles
  const fullText = markdown;
  while ((match = linkPattern.exec(fullText)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();

    // Filtrer : doit être une URL sikafinance et ne pas être un menu/nav
    if (!url.includes('sikafinance.com')) continue;
    if (seenUrls.has(url)) continue;
    if (title.length < 15) continue;  // trop court = navigation
    if (isNavigationLink(title)) continue;

    seenUrls.add(url);

    // Chercher le contexte autour du lien pour extraire résumé + date
    const matchIndex = match.index;
    const contextAfter = fullText.slice(matchIndex + match[0].length, matchIndex + match[0].length + 500);
    const { summary, date, category } = extractContextInfo(contextAfter, title);

    items.push({
      title: cleanTitle(title),
      summary,
      url: url.startsWith('http') ? url : `${SIKA_BASE}${url}`,
      date,
      source: 'sikafinance.com',
      category,
    });

    if (items.length >= 15) break;
  }

  // Si le parsing par liens échoue, on essaie par lignes H2/H3
  if (items.length === 0) {
    return parseFallback(lines);
  }

  return items;
}

function isNavigationLink(title: string): boolean {
  const navKeywords = [
    'accueil', 'connexion', 'inscription', 'menu', 'contact',
    'à propos', 'abonnement', 'newsletter', 'publicité',
    'sikafinance', 'brvm', 'bourse régionale', 'lire la suite',
    'voir plus', 'suivant', 'précédent', 'page'
  ];
  const lower = title.toLowerCase();
  return navKeywords.some(kw => lower === kw || lower.startsWith(kw + ' '));
}

function extractContextInfo(context: string, title: string): {
  summary: string;
  date: string;
  category: string;
} {
  // Chercher une date (formats courants FR)
  const datePattern = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
  const dateMatch = context.match(datePattern);
  const date = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Résumé : premiers 200 caractères de texte propre après le titre
  const cleanContext = context
    .replace(/\[.*?\]\(.*?\)/g, '') // supprimer les liens
    .replace(/[#*_`]/g, '')          // supprimer le markdown
    .replace(/\n+/g, ' ')
    .trim();

  const summary = cleanContext.slice(0, 200).trim() || 'Cliquer pour lire l\'article complet.';

  // Catégorie basée sur le contenu du titre
  const category = inferCategory(title);

  return { summary, date, category };
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('banque') || lower.includes('bank') || lower.includes('crédit')) return 'Banques';
  if (lower.includes('mine') || lower.includes('or') || lower.includes('pétrole')) return 'Matières premières';
  if (lower.includes('résultat') || lower.includes('bénéfice') || lower.includes('chiffre')) return 'Résultats';
  if (lower.includes('ipo') || lower.includes('introduction') || lower.includes('cotation')) return 'Introduction en bourse';
  if (lower.includes('dividende')) return 'Dividendes';
  if (lower.includes('obligations') || lower.includes('taux')) return 'Obligations';
  if (lower.includes('uemoa') || lower.includes('afrique') || lower.includes('cedeao')) return 'Économie';
  return 'BRVM';
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[*_`#]/g, '')
    .trim();
}

function parseFallback(lines: string[]): BRVMNews[] {
  const items: BRVMNews[] = [];
  let i = 0;

  while (i < lines.length && items.length < 10) {
    const line = lines[i].trim();

    if ((line.startsWith('## ') || line.startsWith('### ')) && line.length > 20) {
      const title = cleanTitle(line.replace(/^#{2,3}\s+/, ''));
      if (title.length < 15 || isNavigationLink(title)) { i++; continue; }

      // Collecter le paragraphe suivant
      const summaryLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && summaryLines.length < 3) {
        const l = lines[j].trim();
        if (!l || l.startsWith('#')) break;
        summaryLines.push(l);
        j++;
      }

      items.push({
        title,
        summary: summaryLines.join(' ').slice(0, 200) || 'Lire l\'article pour plus de détails.',
        url: SIKA_NEWS_URL,
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        source: 'sikafinance.com',
        category: inferCategory(title),
      });

      i = j;
    } else {
      i++;
    }
  }

  return items;
}

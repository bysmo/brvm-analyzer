// Scraper pour sikafinance.com via r.jina.ai (contourne Cloudflare)
// Utilise 2 sources qui fonctionnent:
// - /markets/aaz : liste A-Z avec cours/volumes pour toutes les actions
// - /markets/societe/X : infos société, actionnaires, fondamentaux 5 ans

import { BRVM_TOP_LIQUID_30, getStockByTicker, type StockMeta } from './stocks';
import type {
  QuoteData, HistoryRow, DividendRow, Shareholder,
  CompanyInfo, FundamentalYear, StockData,
} from './types';

// Cache en mémoire (TTL 30 minutes)
interface CacheEntry {
  data: StockData | null;
  timestamp: number;
  promise: Promise<StockData | null> | null;
}

const CACHE: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const READER_BASE = 'https://r.jina.ai';

async function fetchMarkdown(url: string): Promise<string> {
  const fullUrl = `${READER_BASE}/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

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

// === PARSERS ===

function parseFrNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s
    .replace(/\s/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Parse la page "societe": infos entreprise + actionnaires + fondamentaux 5 ans
function parseSocietePage(md: string, meta: StockMeta): {
  company: CompanyInfo;
  shareholders: Shareholder[];
  fundamentals: FundamentalYear[];
} {
  let description = '';
  const descMatch = md.match(/\*\*La société\s*:\*\*\s*([^\n]*(?:\n[^\n*]*)*)/i);
  if (descMatch) {
    description = descMatch[1].trim().split(/\n\s*\*\*/)[0].trim();
  }

  const telMatch = md.match(/\*\*Téléphone\s*:\*\*\s*([^\n]+)/i);
  const faxMatch = md.match(/\*\*Fax\s*:\*\*\s*([^\n]+)/i);
  const adrMatch = md.match(/\*\*Adresse\s*:\*\*\s*([^\n]+)/i);
  const dirMatch = md.match(/\*\*Dirigeants\s*:\*\*\s*([^\n]+)/i);

  const nbTitresMatch = md.match(/\*\*Nombre de titres\s*:\*\*\s*([\d\s,.]+)/i);
  const flottantMatch = md.match(/\*\*Flottant\s*:\*\*\s*([\d\s,.]+)%/i);
  const valoMatch = md.match(/\*\*Valorisation de la société\s*:\*\*\s*([\d\s,.]+)\s*MFCFA/i);

  const company: CompanyInfo = {
    description,
    telephone: telMatch ? telMatch[1].trim() : '',
    fax: faxMatch ? faxMatch[1].trim() : '',
    adresse: adrMatch ? adrMatch[1].trim() : '',
    dirigeants: dirMatch ? dirMatch[1].trim() : '',
    nombreTitres: nbTitresMatch ? parseFrNumber(nbTitresMatch[1]) : 0,
    flottant: flottantMatch ? parseFrNumber(flottantMatch[1]) : 0,
    valorisation: valoMatch ? parseFrNumber(valoMatch[1]) : 0,
  };

  // Actionnaires: ligne type "BOA WEST AFRICA*54,11;DIVERS...*43,31;..."
  const shareholders: Shareholder[] = [];
  const shRawMatch = md.match(/Principaux actionnaires\s*\n+([A-Z][^\n]*(?:\*[\d,]+[^\n]*)*)/i);
  let rawLine = '';
  if (shRawMatch) {
    rawLine = shRawMatch[1];
  }
  if (!rawLine) {
    const altMatch = md.match(/([A-Z][A-Z\s\(\)\.&'*,;-]+\*[\d,]+(?:;[A-Z\s\(\)\.&'*,;-]+\*[\d,]+)+)/);
    if (altMatch) rawLine = altMatch[1];
  }

  if (rawLine) {
    const parts = rawLine.split(';').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\*([\d,]+)$/);
      if (m) {
        const name = m[1].trim();
        const percentage = parseFrNumber(m[2]);
        if (percentage > 0) {
          shareholders.push({
            name,
            percentage,
            isLocal: null,
            type: 'inconnu',
          });
        }
      }
    }
  }

  // Fundamentals: tableau 5 ans
  const fundamentals: FundamentalYear[] = [];
  const fullTableMatch = md.match(/Les chiffres sont en millions de FCFA\s*\n((?:\s*\|[^\n]+\n)+)/i);
  if (fullTableMatch) {
    const allLines = fullTableMatch[1].split('\n').filter(l => l.trim().startsWith('|'));
    if (allLines.length >= 3) {
      const headers = allLines[0].split('|').map(c => c.trim()).filter(Boolean);
      const years: number[] = [];
      for (const h of headers) {
        const ym = h.match(/^(\d{4})$/);
        if (ym) years.push(parseInt(ym[1], 10));
      }

      const rows: Record<string, (number|null)[]> = {};
      for (let i = 2; i < allLines.length; i++) {
        const cols = allLines[i].split('|').map(c => c.trim());
        let label = cols[1] || '';
        if (!label && i > 2) {
          const prevLabel = Object.keys(rows).pop() || '';
          if (prevLabel.includes("Chiffre d'affaires")) label = 'Croissance CA';
          else if (prevLabel.includes('Résultat net')) label = 'Croissance RN';
          else label = 'Inconnu';
        }
        label = label.replace(/\*\*/g, '').trim();
        if (!label) continue;
        const values: (number|null)[] = [];
        for (let j = 2; j < cols.length; j++) {
          const v = cols[j];
          if (!v || v === '' || v === '-') {
            values.push(null);
          } else {
            values.push(parseFrNumber(v.replace('%', '')));
          }
        }
        rows[label] = values;
      }

      const caArr = rows["Chiffre d'affaires"] || rows["CHIFFRE D'AFFAIRES"] || [];
      const caGrowthArr = rows['Croissance CA'] || [];
      const rnArr = rows['Résultat net'] || rows['RESULTAT NET'] || [];
      const rnGrowthArr = rows['Croissance RN'] || [];
      const bnpaArr = rows['BNPA'] || [];
      const perArr = rows['PER'] || [];
      const divArr = rows['Dividende'] || rows['DIVIDENDE'] || [];

      for (let i = 0; i < years.length; i++) {
        fundamentals.push({
          year: years[i],
          chiffreAffaires: caArr[i] ?? 0,
          croissanceCA: caGrowthArr[i],
          resultatNet: rnArr[i] ?? 0,
          croissanceRN: rnGrowthArr[i],
          bnpa: bnpaArr[i] ?? 0,
          per: perArr[i] ?? 0,
          dividende: divArr[i] ?? 0,
        });
      }
    }
  }

  return { company, shareholders, fundamentals };
}

// Classification d'un actionnaire en local/étranger
function classifyShareholder(name: string, hostCountry: string): 'local' | 'etranger' | 'mixte' | 'inconnu' {
  const upper = name.toUpperCase();
  const foreignPatterns = [
    /ATTICA/i, /BOAD/i, /BNP PARIBAS/i, /SOCIETE GENERALE/i, /CFAO/i,
    /NESTLE/i, /UNILEVER/i, /ORANGE\s*SA/i, /TOTAL/i, /VIVO/i, /SHELL/i,
    /ECOBANK\s*(?:GROUP|HOLDING|TRANSNATIONAL|ETI)/i, /\bETI\b/i,
    /FRENCH/i, /INTERNATIONAL\s+(?:FINANCE|BANK|GROUP)/i, /FOREIGN/i,
    /HOLDING\s*EUR/i, /AFRICA\s*GLOBAL/i, /MAGRABIN/i,
    /RISE/i, /DEVELOPMENT\s*BANK/i, /\bIFC\b/i, /\bEIB\b/i, /PROPARCO/i,
    /BOA\s*WEST\s*AFRICA/i, /BOA\s*GROUP/i, /BANK\s*OF\s*AFRICA\s*GROUP/i,
    /INSTITUTION/i, /\bFONDS\b/i, /\bFUND\b/i, /KKR/i, /WARBURG/i,
    /PIC/i, /DESHAWN/i, /TRIPOD/i, /AGRICOLE/i, /CREDIT/i, /STANBIC/i,
    /ATTICA/i, /BANK\s*OF\s*NEW\s*YORK/i, /MELLON/i, /JP\s*MORGAN/i,
    /GIC/i, /TEMASEK/i, /SANTANDER/i, /CITI/i, /HSBC/i, /BARCLAYS/i,
    /DEUTSCHE/i, /BBVA/i, /INTESA/i, /UNICREDIT/i, /ING\s*GROUP/i,
    /AXA/i, /ALLIANZ/i, /ZURICH/i, /GENERALI/i, /MUNICH\s*RE/i,
    /EQUITY\s*BANK/i, /KCB/i, /NCBA/i, /STANDARD\s*BANK/i, /NEDBANK/i,
    /GOVT\s*OF/i, /GOVERNMENT\s*OF/i, /REPUBLIQUE\s*DU/i,
    /SENEGAL/i, /COTE\s*D.?IVOIRE/i, /BENIN/i, /BURKINA/i, /MALI/i, /NIGER/i, /TOGO/i,
  ];
  const localPatterns = [
    /ETAT/i, /REPUBLIQUE/i, /GOUVERNEMENT/i, /EMPLOY/i, /PERSONNEL/i,
    /NATIONA/i, /POPULAIRE/i, /MUTUELLE/i, /FONDS\s*NATIONAL/i,
  ];
  const mixtePatterns = [
    /DIVERS/i, /PORTFOLIO/i, /BOURSE/i, /PUBLIC/i, /FLOTTE/i, /FLOTTANT/i,
    /INVESTOR/i, /INVESTISSEUR/i, /PRIVE/i,
  ];

  if (mixtePatterns.some(p => p.test(upper))) return 'mixte';
  if (foreignPatterns.some(p => p.test(upper))) return 'etranger';
  if (localPatterns.some(p => p.test(upper))) return 'local';

  // Si le nom contient le pays hôte, probablement local
  const hostCountryUpper = hostCountry.toUpperCase();
  if (upper.includes(hostCountryUpper)) return 'local';

  return 'inconnu';
}

// Récupère la liste A-Z complète
export interface MarketListRow {
  ticker: string;
  name: string;
  ouverture: number;
  plusHaut: number;
  plusBas: number;
  volumeTitres: number;
  volumeXOF: number;
  dernier: number;
  variation: number;
  inTopBRVM30: boolean;
}

let marketListCache: { data: MarketListRow[]; timestamp: number } | null = null;

export async function fetchMarketList(): Promise<MarketListRow[]> {
  const now = Date.now();
  if (marketListCache && (now - marketListCache.timestamp) < CACHE_TTL_MS) {
    return marketListCache.data;
  }
  try {
    const md = await fetchMarkdown('https://www.sikafinance.com/marches/aaz');
    const rows: MarketListRow[] = [];

    const tableMatch = md.match(/BRVM\s*:\s*Les actions cotées\s*\n([\s\S]*?)(?:\n\s*##|\n\s*Copyright|$)/i);
    if (!tableMatch) {
      console.error('[fetchMarketList] Could not find table "Les actions cotées"');
      return rows;
    }

    const lines = tableMatch[1].split('\n').filter(l => l.trim().startsWith('|'));
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 7) continue;
      const nameMatch = cols[0].match(/^\[([^\]]+)\]\([^)]*cotation_([^)]+)\)/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      const ticker = nameMatch[2];

      const dernierStr = cols[6].replace(/\*\*/g, '').trim();
      const variationStr = cols[7] || cols[6];

      rows.push({
        ticker,
        name,
        ouverture: parseFrNumber(cols[1]),
        plusHaut: parseFrNumber(cols[2]),
        plusBas: parseFrNumber(cols[3]),
        volumeTitres: parseFrNumber(cols[4]),
        volumeXOF: parseFrNumber(cols[5]),
        dernier: parseFrNumber(dernierStr),
        variation: parseFrNumber(variationStr),
        inTopBRVM30: BRVM_TOP_LIQUID_30.includes(ticker),
      });
    }
    marketListCache = { data: rows, timestamp: now };
    return rows;
  } catch (err) {
    console.error('[fetchMarketList] Error:', err);
    return marketListCache?.data || [];
  }
}

export async function getMarketListCached(): Promise<MarketListRow[]> {
  return fetchMarketList();
}

/**
 * Force un nouveau scraping en invalidant le cache mémoire.
 * À appeler depuis le cron pour garantir des données fraîches.
 */
export async function forceRefreshMarketList(): Promise<MarketListRow[]> {
  marketListCache = null; // invalide le cache
  return fetchMarketList();
}

// Récupère une entrée de la liste A-Z pour une action spécifique
async function getMarketListEntry(ticker: string): Promise<MarketListRow | null> {
  const list = await fetchMarketList();
  return list.find(r => r.ticker.toLowerCase() === ticker.toLowerCase()) || null;
}

// === FONCTION PRINCIPALE ===

export async function fetchStockData(ticker: string, forceRefresh = false): Promise<StockData | null> {
  const meta = getStockByTicker(ticker);
  if (!meta) return null;

  const now = Date.now();
  const cached = CACHE[ticker];

  if (!forceRefresh && cached && cached.data && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = (async (): Promise<StockData | null> => {
    try {
      // En parallèle: societe page + market list entry
      const [societeMd, marketEntry] = await Promise.all([
        fetchMarkdown(`https://www.sikafinance.com/marches/societe/${ticker}`),
        getMarketListEntry(ticker),
      ]);

      const socData = parseSocietePage(societeMd, meta);

      // Quote data depuis l'entrée de la market list
      const quote: QuoteData = {
        ticker: meta.ticker,
        name: meta.name,
        isin: meta.isin,
        price: marketEntry?.dernier ?? 0,
        variation: marketEntry?.variation ?? 0,
        volumeTitres: marketEntry?.volumeTitres ?? 0,
        volumeXOF: marketEntry?.volumeXOF ?? 0,
        ouverture: marketEntry?.ouverture ?? 0,
        plusHaut: marketEntry?.plusHaut ?? 0,
        plusBas: marketEntry?.plusBas ?? 0,
        clotureVeille: 0,  // Non disponible dans A-Z, on calcule si possible
        beta1an: 0,
        rsi: 0,
        capitalEchange: 0,
        valorisation: socData.company.valorisation,
        lastUpdate: new Date().toISOString(),
      };

      // Calcul de la clôture veille à partir du dernier et de la variation
      if (quote.price > 0 && quote.variation !== 0) {
        quote.clotureVeille = Math.round(quote.price / (1 + quote.variation / 100));
      }

      // Capital échangé = volume titres / nombre total de titres
      if (socData.company.nombreTitres > 0 && quote.volumeTitres > 0) {
        quote.capitalEchange = (quote.volumeTitres / socData.company.nombreTitres) * 100;
      }

      // Classification des actionnaires
      const shareholders = socData.shareholders.map(sh => ({
        ...sh,
        type: classifyShareholder(sh.name, meta.countryName),
      }));

      // Dividendes: depuis les fondamentaux (5 dernières années)
      const dividends: DividendRow[] = [];
      for (const f of socData.fundamentals) {
        if (f.dividende > 0 && quote.price > 0) {
          const yieldPct = (f.dividende / quote.price) * 100;
          dividends.push({
            year: f.year,
            amount: f.dividende,
            yield: parseFloat(yieldPct.toFixed(2)),
          });
        } else if (f.dividende > 0) {
          dividends.push({
            year: f.year,
            amount: f.dividende,
            yield: 0,
          });
        }
      }

      // Historique: on n'a pas les données 1S/1M/1A/3A/5A, on met un tableau vide
      // Le frontend affichera un message "Données historiques non disponibles"
      const history: HistoryRow[] = [];

      const stockData: StockData = {
        ticker: meta.ticker,
        meta: {
          name: meta.name,
          isin: meta.isin,
          country: meta.country,
          countryName: meta.countryName,
          sector: meta.sector,
          flag: meta.flag,
        },
        quote,
        history,
        dividends,
        shareholders,
        company: socData.company,
        fundamentals: socData.fundamentals,
        sentiment: undefined,
        fetchedAt: new Date().toISOString(),
      };

      CACHE[ticker] = { data: stockData, timestamp: Date.now(), promise: null };
      return stockData;
    } catch (err) {
      console.error(`[fetchStockData] Error for ${ticker}:`, err);
      CACHE[ticker] = { data: cached?.data || null, timestamp: Date.now(), promise: null };
      return cached?.data || null;
    }
  })();

  CACHE[ticker] = { data: cached?.data || null, timestamp: now, promise };

  return promise;
}

// Récupère plusieurs actions en parallèle (pour pré-chargement)
export async function fetchMultipleStocks(tickers: string[]): Promise<StockData[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += 4) {
    chunks.push(tickers.slice(i, i + 4));
  }
  const results: StockData[] = [];
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(t => fetchStockData(t)));
    for (const r of chunkResults) {
      if (r) results.push(r);
    }
  }
  return results;
}

// Debug script: fetch and inspect raw markdown from sikafinance via r.jina.ai
const READER_BASE = 'https://r.jina.ai';

async function fetchMarkdown(url: string): Promise<string> {
  const fullUrl = `${READER_BASE}/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'X-Return-Format': 'markdown' },
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

async function main() {
  const ticker = process.argv[2] || 'BOAB.bj';
  console.log(`Fetching cotation page for ${ticker}...`);
  const md = await fetchMarkdown(`https://www.sikafinance.com/markets/cotation_${ticker}`);
  console.log(`Length: ${md.length}`);
  console.log('=== RAW MARKDOWN (first 4000 chars) ===');
  console.log(md.substring(0, 4000));
  console.log('=== ... ===');
  console.log(md.substring(md.length - 2000));
}

main().catch(console.error);

import { NextResponse } from 'next/server';
import { BRVM_STOCKS, BRVM_TOP_LIQUID_30, getAllSectors } from '@/lib/brvm/stocks';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    stocks: BRVM_STOCKS.map(s => ({
      ticker: s.ticker,
      name: s.name,
      isin: s.isin,
      country: s.country,
      countryName: s.countryName,
      sector: s.sector,
      flag: s.flag,
      inTopBRVM30: BRVM_TOP_LIQUID_30.includes(s.ticker),
    })),
    sectors: getAllSectors(),
    totalStocks: BRVM_STOCKS.length,
    topLiquid30: BRVM_TOP_LIQUID_30,
  });
}

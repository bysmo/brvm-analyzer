// Liste complète des actions cotées à la BRVM (source: sikafinance.com/marches/aaz)
// Chaque entrée contient: ticker sikafinance, nom, code ISIN, pays d'implantation, secteur

export type Country = 'CI' | 'SN' | 'BF' | 'BJ' | 'ML' | 'NE' | 'TG';

export interface StockMeta {
  ticker: string;       // ex: "BOAB.bj"
  name: string;         // ex: "BANK OF AFRICA BENIN"
  isin: string;         // ex: "BJ0000000048"
  country: Country;     // pays d'implantation
  countryName: string;
  sector: string;       // secteur d'activité
  flag: string;         // emoji drapeau
}

export const BRVM_STOCKS: StockMeta[] = [
  { ticker: 'SDSC.ci', name: 'AFRICA GLOBAL LOGISTICS', isin: 'CI0000000016', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Transport', flag: '🇨🇮' },
  { ticker: 'BOAB.bj', name: 'BANK OF AFRICA BENIN', isin: 'BJ0000000048', country: 'BJ', countryName: 'Bénin', sector: 'Banque', flag: '🇧🇯' },
  { ticker: 'BOABF.bf', name: 'BANK OF AFRICA BURKINA FASO', isin: 'BF0000000012', country: 'BF', countryName: 'Burkina Faso', sector: 'Banque', flag: '🇧🇫' },
  { ticker: 'BOAC.ci', name: 'BANK OF AFRICA CI', isin: 'CI0000000024', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'BOAM.ml', name: 'BANK OF AFRICA MALI', isin: 'ML0000000010', country: 'ML', countryName: 'Mali', sector: 'Banque', flag: '🇲🇱' },
  { ticker: 'BOAN.ne', name: 'BANK OF AFRICA NIGER', isin: 'NE0000000008', country: 'NE', countryName: 'Niger', sector: 'Banque', flag: '🇳🇪' },
  { ticker: 'BOAS.sn', name: 'BANK OF AFRICA SENEGAL', isin: 'SN0000000014', country: 'SN', countryName: 'Sénégal', sector: 'Banque', flag: '🇸🇳' },
  { ticker: 'BICB.bj', name: 'BANQUE INTERNATIONALE POUR LE COMMERCE DU BENIN', isin: 'BJ0000000055', country: 'BJ', countryName: 'Bénin', sector: 'Banque', flag: '🇧🇯' },
  { ticker: 'BNBC.ci', name: 'BERNABE', isin: 'CI0000000032', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'BICC.ci', name: 'BICICI', isin: 'CI0000000040', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'CFAC.ci', name: 'CFAO CI', isin: 'CI0000000057', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
  { ticker: 'CIEC.ci', name: 'CIE CI', isin: 'CI0000000065', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Services Publics', flag: '🇨🇮' },
  { ticker: 'CBIBF.bf', name: 'CORIS BANK INTERNATIONAL BF', isin: 'BF0000000020', country: 'BF', countryName: 'Burkina Faso', sector: 'Banque', flag: '🇧🇫' },
  { ticker: 'SEMC.ci', name: 'CROWN SIEM', isin: 'CI0000000073', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'ECOC.ci', name: 'ECOBANK CI', isin: 'CI0000000081', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'SIVC.ci', name: 'ERIUM', isin: 'CI0000000099', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'ETIT.tg', name: 'ETI TG', isin: 'TG0000000017', country: 'TG', countryName: 'Togo', sector: 'Banque', flag: '🇹🇬' },
  { ticker: 'FTSC.ci', name: 'FILTISAC CI', isin: 'CI0000000107', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'LNBB.bj', name: 'LOTARIE NATIONALE DU BENIN', isin: 'BJ0000000063', country: 'BJ', countryName: 'Bénin', sector: 'Autres Secteurs', flag: '🇧🇯' },
  { ticker: 'SVOC.ci', name: 'MOVIS CI', isin: 'CI0000000115', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Transport', flag: '🇨🇮' },
  { ticker: 'NEIC.ci', name: 'NEI CEDA CI', isin: 'CI0000000123', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
  { ticker: 'NTLC.ci', name: 'NESTLE CI', isin: 'CI0000000131', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Consommation de base', flag: '🇨🇮' },
  { ticker: 'NSBC.ci', name: 'NSIA BANQUE', isin: 'CI0000000149', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'ONTBF.bf', name: 'ONATEL BF', isin: 'BF0000000038', country: 'BF', countryName: 'Burkina Faso', sector: 'Télécommunications', flag: '🇧🇫' },
  { ticker: 'ORGT.tg', name: 'ORAGROUP TOGO', isin: 'TG0000000025', country: 'TG', countryName: 'Togo', sector: 'Banque', flag: '🇹🇬' },
  { ticker: 'ORAC.ci', name: 'ORANGE CI', isin: 'CI0000000156', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Télécommunications', flag: '🇨🇮' },
  { ticker: 'PALC.ci', name: 'PALMCI', isin: 'CI0000000164', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Agriculture', flag: '🇨🇮' },
  { ticker: 'SAFC.ci', name: 'SAFCA CI', isin: 'CI0000000172', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Finance', flag: '🇨🇮' },
  { ticker: 'SPHC.ci', name: 'SAPH CI', isin: 'CI0000000180', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Agriculture', flag: '🇨🇮' },
  { ticker: 'ABJC.ci', name: 'SERVAIR ABIDJAN CI', isin: 'CI0000000198', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Transport', flag: '🇨🇮' },
  { ticker: 'STAC.ci', name: 'SETAO CI', isin: 'CI0000000206', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'SGBC.ci', name: 'SGBCI', isin: 'CI0000000214', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'CABC.ci', name: 'SICABLE CI', isin: 'CI0000000222', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'SICC.ci', name: 'SICOR', isin: 'CI0000000230', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Finance', flag: '🇨🇮' },
  { ticker: 'STBC.ci', name: 'SITAB', isin: 'CI0000000248', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Industrie', flag: '🇨🇮' },
  { ticker: 'SMBC.ci', name: 'SMB CI', isin: 'CI0000000255', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Consommation de base', flag: '🇨🇮' },
  { ticker: 'SIBC.ci', name: 'SOCIETE IVOIRIENNE DE BANQUE CI', isin: 'CI0000000263', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Banque', flag: '🇨🇮' },
  { ticker: 'SDCC.ci', name: 'SODECI', isin: 'CI0000000271', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
  { ticker: 'SOGC.ci', name: 'SOGB', isin: 'CI0000000289', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Agriculture', flag: '🇨🇮' },
  { ticker: 'SLBC.ci', name: 'SOLIBRA CI', isin: 'CI0000000297', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Consommation de base', flag: '🇨🇮' },
  { ticker: 'SNTS.sn', name: 'SONATEL', isin: 'SN0000000022', country: 'SN', countryName: 'Sénégal', sector: 'Télécommunications', flag: '🇸🇳' },
  { ticker: 'SCRC.ci', name: 'SUCRIVOIRE', isin: 'CI0000000305', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Agriculture', flag: '🇨🇮' },
  { ticker: 'TTLC.ci', name: 'TOTAL CI', isin: 'CI0000000313', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
  { ticker: 'TTLS.sn', name: 'TOTAL SENEGAL', isin: 'SN0000000030', country: 'SN', countryName: 'Sénégal', sector: 'Distribution', flag: '🇸🇳' },
  { ticker: 'PRSC.ci', name: 'TRACTAFRIC MOTORS CI', isin: 'CI0000000321', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
  { ticker: 'UNLC.ci', name: 'UNILEVER CI', isin: 'CI0000000339', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Consommation de base', flag: '🇨🇮' },
  { ticker: 'UNXC.ci', name: 'UNIWAX CI', isin: 'CI0000000347', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Consommation discrétionnaire', flag: '🇨🇮' },
  { ticker: 'SHEC.ci', name: 'VIVO ENERGY CI', isin: 'CI0000000354', country: 'CI', countryName: "Côte d'Ivoire", sector: 'Distribution', flag: '🇨🇮' },
];

// Top 30 actions les plus liquides publiées par la BRVM chaque trimestre
// Source: classement officiel BRVM - les valeurs les plus échangées historiquement
export const BRVM_TOP_LIQUID_30: string[] = [
  'ETIT.tg', 'SNTS.sn', 'ORAC.ci', 'ECOC.ci', 'ONTBF.bf',
  'SAFC.ci', 'SGBC.ci', 'BOAC.ci', 'SIBC.ci', 'PALC.ci',
  'SPHC.ci', 'NSBC.ci', 'SDCC.ci', 'TTLC.ci', 'SOGC.ci',
  'NTLC.ci', 'BOAB.bj', 'CBIBF.bf', 'UNXC.ci', 'CIEC.ci',
  'FTSC.ci', 'SDSC.ci', 'ABJC.ci', 'ORGT.tg', 'SCRC.ci',
  'BOABF.bf', 'CABC.ci', 'CFAC.ci', 'TTLS.sn', 'BOAS.sn',
];

export const COUNTRY_CODE_MAP: Record<string, Country> = {
  'ci': 'CI', 'sn': 'SN', 'bf': 'BF', 'bj': 'BJ', 'ml': 'ML', 'ne': 'NE', 'tg': 'TG',
};

export function getStockByTicker(ticker: string): StockMeta | undefined {
  return BRVM_STOCKS.find(s => s.ticker.toLowerCase() === ticker.toLowerCase());
}

export function getStocksBySector(sector: string): StockMeta[] {
  return BRVM_STOCKS.filter(s => s.sector === sector);
}

export function getAllSectors(): string[] {
  return Array.from(new Set(BRVM_STOCKS.map(s => s.sector))).sort();
}

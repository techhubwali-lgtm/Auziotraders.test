/**
 * Active International ISO 4217 Currencies Directory with Country Flags.
 * Automatically imports and resolves EVERY currency returned by ExchangeRate-API
 * (https://open.er-api.com/v6/latest/USD & /JPY) with code, name, symbol, and country flag.
 */

export interface CurrencyDescriptor {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  countryCode?: string;
  popular?: boolean;
}

/** Converts an ISO 3166-1 alpha-2 country code (e.g. "JP") into its regional indicator flag emoji ("🇯🇵"). */
export function countryCodeToFlag(countryCode: string): string {
  const code = (countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

/** Special currency -> flag overrides for supranational / non-standard prefix currencies */
const SPECIAL_FLAGS: Record<string, string> = {
  EUR: '🇪🇺',
  XAF: '🌍',
  XCD: '🌎',
  XOF: '🌍',
  XPF: '🇵🇫',
  XDR: '🌐',
  XCG: '🇨🇼',
  ANG: '🇨🇼',
  BTC: '₿',
  GGP: '🇬🇬',
  IMP: '🇮🇲',
  JEP: '🇯🇪',
  TVD: '🇹🇻',
  KID: '🇰🇮',
  FOK: '🇫🇴',
  ZWG: '🇿🇼',
  ZWL: '🇿🇼',
  SLE: '🇸🇱',
  SSP: '🇸🇸',
  STN: '🇸🇹',
  VES: '🇻🇪',
  MRU: '🇲🇷',
  BYN: '🇧🇾',
  CUC: '🇨🇺',
};

function resolveFlagForCurrency(code: string, countryCode?: string): string {
  const upper = code.toUpperCase();
  if (SPECIAL_FLAGS[upper]) return SPECIAL_FLAGS[upper];
  const cc = countryCode || upper.slice(0, 2);
  return countryCodeToFlag(cc);
}

interface RawCurrencyEntry {
  code: string;
  name: string;
  symbol: string;
  countryCode?: string;
  popular?: boolean;
}

const RAW_WORLD_CURRENCIES: RawCurrencyEntry[] = [
  // Popular international vehicle export currencies
  { code: 'USD', name: 'United States Dollar', symbol: '$', countryCode: 'US', popular: true },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', countryCode: 'JP', popular: true },
  { code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU', popular: true },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', countryCode: 'GB', popular: true },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', countryCode: 'AU', popular: true },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', countryCode: 'NZ', popular: true },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', countryCode: 'CA', popular: true },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', countryCode: 'KE', popular: true },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', countryCode: 'TZ', popular: true },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', countryCode: 'UG', popular: true },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', countryCode: 'ZA', popular: true },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', countryCode: 'ZM', popular: true },
  { code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'AED', countryCode: 'AE', popular: true },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', countryCode: 'JM', popular: true },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', countryCode: 'PK', popular: true },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', countryCode: 'BD', popular: true },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', countryCode: 'LK', popular: true },

  // Complete Active ISO 4217 International Currencies
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', countryCode: 'AF' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L', countryCode: 'AL' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', countryCode: 'AM' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', countryCode: 'CW' },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', countryCode: 'AO' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', countryCode: 'AR' },
  { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', countryCode: 'AW' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', countryCode: 'AZ' },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', countryCode: 'BA' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', countryCode: 'BB' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', countryCode: 'BG' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', countryCode: 'BH' },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', countryCode: 'BI' },
  { code: 'BMD', name: 'Bermudian Dollar', symbol: '$', countryCode: 'BM' },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', countryCode: 'BN' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.', countryCode: 'BO' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', countryCode: 'BR' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', countryCode: 'BS' },
  { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', countryCode: 'BT' },
  { code: 'BWP', name: 'Botswanan Pula', symbol: 'P', countryCode: 'BW' },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', countryCode: 'BY' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', countryCode: 'BZ' },
  { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', countryCode: 'CD' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', countryCode: 'CH' },
  { code: 'CLF', name: 'Chilean Unit of Account (UF)', symbol: 'UF', countryCode: 'CL' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', countryCode: 'CL' },
  { code: 'CNH', name: 'Chinese Yuan (Offshore)', symbol: '¥', countryCode: 'CN' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', countryCode: 'CN' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', countryCode: 'CO' },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', countryCode: 'CR' },
  { code: 'CUP', name: 'Cuban Peso', symbol: '$', countryCode: 'CU' },
  { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', countryCode: 'CV' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', countryCode: 'CZ' },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', countryCode: 'DJ' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', countryCode: 'DK' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', countryCode: 'DO' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'DA', countryCode: 'DZ' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', countryCode: 'EG' },
  { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', countryCode: 'ER' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', countryCode: 'ET' },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', countryCode: 'FJ' },
  { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£', countryCode: 'FK' },
  { code: 'FOK', name: 'Faroese Króna', symbol: 'kr', countryCode: 'FO' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', countryCode: 'GE' },
  { code: 'GGP', name: 'Guernsey Pound', symbol: '£', countryCode: 'GG' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', countryCode: 'GH' },
  { code: 'GIP', name: 'Gibraltar Pound', symbol: '£', countryCode: 'GI' },
  { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', countryCode: 'GM' },
  { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', countryCode: 'GN' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', countryCode: 'GT' },
  { code: 'GYD', name: 'Guyanaese Dollar', symbol: 'G$', countryCode: 'GY' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', countryCode: 'HK' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', countryCode: 'HN' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', countryCode: 'HR' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', countryCode: 'HT' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', countryCode: 'HU' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', countryCode: 'ID' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', countryCode: 'IL' },
  { code: 'IMP', name: 'Manx Pound', symbol: '£', countryCode: 'IM' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', countryCode: 'IN' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'IQD', countryCode: 'IQ' },
  { code: 'IRR', name: 'Iranian Rial', symbol: 'IRR', countryCode: 'IR' },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', countryCode: 'IS' },
  { code: 'JEP', name: 'Jersey Pound', symbol: '£', countryCode: 'JE' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD', countryCode: 'JO' },
  { code: 'KGS', name: 'Kyrgystani Som', symbol: 'с', countryCode: 'KG' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', countryCode: 'KH' },
  { code: 'KID', name: 'Kiribati Dollar', symbol: '$', countryCode: 'KI' },
  { code: 'KMF', name: 'Comorian Franc', symbol: 'CF', countryCode: 'KM' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', countryCode: 'KR' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', countryCode: 'KW' },
  { code: 'KYD', name: 'Cayman Islands Dollar', symbol: 'CI$', countryCode: 'KY' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', countryCode: 'KZ' },
  { code: 'LAK', name: 'Laotian Kip', symbol: '₭', countryCode: 'LA' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'L£', countryCode: 'LB' },
  { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', countryCode: 'LR' },
  { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', countryCode: 'LS' },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'LD', countryCode: 'LY' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', countryCode: 'MA' },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', countryCode: 'MD' },
  { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', countryCode: 'MG' },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', countryCode: 'MK' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', countryCode: 'MM' },
  { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', countryCode: 'MN' },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', countryCode: 'MO' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', countryCode: 'MR' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: 'Rs', countryCode: 'MU' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', countryCode: 'MV' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', countryCode: 'MW' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', countryCode: 'MX' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', countryCode: 'MY' },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', countryCode: 'MZ' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', countryCode: 'NA' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', countryCode: 'NG' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', countryCode: 'NI' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', countryCode: 'NO' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', countryCode: 'NP' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', countryCode: 'OM' },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', countryCode: 'PA' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', countryCode: 'PE' },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', countryCode: 'PG' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', countryCode: 'PH' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', countryCode: 'PL' },
  { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', countryCode: 'PY' },
  { code: 'QAR', name: 'Qatari Rial', symbol: 'QR', countryCode: 'QA' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', countryCode: 'RO' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'din.', countryCode: 'RS' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', countryCode: 'RU' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', countryCode: 'RW' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', countryCode: 'SA' },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', countryCode: 'SB' },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: 'SR', countryCode: 'SC' },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'SDG', countryCode: 'SD' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', countryCode: 'SE' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', countryCode: 'SG' },
  { code: 'SHP', name: 'Saint Helena Pound', symbol: '£', countryCode: 'SH' },
  { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le', countryCode: 'SL' },
  { code: 'SLL', name: 'Sierra Leonean Leone (Old)', symbol: 'Le', countryCode: 'SL' },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', countryCode: 'SO' },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: '$', countryCode: 'SR' },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: '£', countryCode: 'SS' },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra', symbol: 'Db', countryCode: 'ST' },
  { code: 'SYP', name: 'Syrian Pound', symbol: '£S', countryCode: 'SY' },
  { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', countryCode: 'SZ' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', countryCode: 'TH' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM', countryCode: 'TJ' },
  { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T', countryCode: 'TM' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT', countryCode: 'TN' },
  { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', countryCode: 'TO' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', countryCode: 'TR' },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: 'TT$', countryCode: 'TT' },
  { code: 'TVD', name: 'Tuvaluan Dollar', symbol: '$', countryCode: 'TV' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', countryCode: 'TW' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', countryCode: 'UA' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', countryCode: 'UY' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', countryCode: 'UZ' },
  { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.S', countryCode: 'VE' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', countryCode: 'VN' },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', countryCode: 'VU' },
  { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', countryCode: 'WS' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA' },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$' },
  { code: 'XCG', name: 'Caribbean Guilder', symbol: 'Cg', countryCode: 'CW' },
  { code: 'XDR', name: 'IMF Special Drawing Rights', symbol: 'SDR' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA' },
  { code: 'XPF', name: 'CFP Franc', symbol: '₣', countryCode: 'PF' },
  { code: 'YER', name: 'Yemeni Rial', symbol: 'YR', countryCode: 'YE' },
  { code: 'ZWG', name: 'Zimbabwe Gold', symbol: 'ZiG', countryCode: 'ZW' },
  { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$', countryCode: 'ZW' },
];

export const WORLD_CURRENCIES: CurrencyDescriptor[] = RAW_WORLD_CURRENCIES.map((entry) => ({
  ...entry,
  flag: resolveFlagForCurrency(entry.code, entry.countryCode),
}));

const CURRENCY_LOOKUP = new Map<string, CurrencyDescriptor>(
  WORLD_CURRENCIES.map((c) => [c.code, c])
);

let intlCurrencyNames: Intl.DisplayNames | null = null;
try {
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    intlCurrencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
  }
} catch {
  intlCurrencyNames = null;
}

export function getCurrencyDescriptor(code: string): CurrencyDescriptor {
  const upper = (code || 'USD').toUpperCase();
  const known = CURRENCY_LOOKUP.get(upper);
  if (known) return known;

  let resolvedName = upper;
  try {
    resolvedName = intlCurrencyNames?.of(upper) || upper;
  } catch {
    resolvedName = upper;
  }

  let resolvedSymbol = upper;
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: upper,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    const sym = parts.find((p) => p.type === 'currency')?.value;
    if (sym) resolvedSymbol = sym;
  } catch {
    resolvedSymbol = upper;
  }

  return {
    code: upper,
    name: resolvedName,
    symbol: resolvedSymbol,
    flag: resolveFlagForCurrency(upper),
  };
}

/**
 * Automatically imports EVERY currency code returned by ExchangeRate-API,
 * preserving popular trade currencies at the top and sorting the rest alphabetically.
 */
export function buildDynamicCurrencyList(
  apiRates?: Record<string, number>
): CurrencyDescriptor[] {
  const codes = new Set<string>(WORLD_CURRENCIES.map((c) => c.code));
  if (apiRates) {
    for (const code of Object.keys(apiRates)) {
      const upper = code.toUpperCase();
      if (/^[A-Z]{3}$/.test(upper) && typeof apiRates[code] === 'number' && apiRates[code] > 0) {
        codes.add(upper);
      }
    }
  }

  const popularList: CurrencyDescriptor[] = [];
  const otherList: CurrencyDescriptor[] = [];

  for (const code of codes) {
    const desc = getCurrencyDescriptor(code);
    if (desc.popular) {
      popularList.push(desc);
    } else {
      otherList.push(desc);
    }
  }

  // Keep curated order for popular currencies
  const popularOrder = new Map(
    WORLD_CURRENCIES.filter((c) => c.popular).map((c, idx) => [c.code, idx])
  );
  popularList.sort((a, b) => (popularOrder.get(a.code) ?? 999) - (popularOrder.get(b.code) ?? 999));
  otherList.sort((a, b) => a.code.localeCompare(b.code));

  return [...popularList, ...otherList];
}

/**
 * Single Editable Pricing Configuration for Japanese Dealer Stock (Carapis).
 *
 * Edit AUZIO_FEE_JPY, SHIPPING_UK_JPY, or MARGIN_PERCENT here to update all
 * Dealer Stock GBP landed prices across the entire portal automatically.
 *
 * Formula:
 *   finalJpy = (carPriceJpy + AUZIO_FEE_JPY + SHIPPING_UK_JPY) * (1 + MARGIN_PERCENT / 100)
 *   finalGbp = finalJpy * jpyToGbpRate  (from our existing live ExchangeRate-API)
 */
export const DEALER_PRICING_CONFIG = {
  AUZIO_FEE_JPY: 100000,
  SHIPPING_UK_JPY: 200000,
  MARGIN_PERCENT: 10,
} as const;

export interface DealerGbpPriceResult {
  carPriceJpy: number;
  auzioFeeJpy: number;
  shippingUkJpy: number;
  marginPercent: number;
  finalJpy: number;
  finalGbp: number;
  jpyToGbpRate: number;
  rateAvailable: boolean;
}

/**
 * Resolves the JPY -> GBP conversion rate using the portal's existing live
 * ExchangeRate-API rates (without modifying the exchange rate integration).
 */
export function resolveJpyToGbpRate(
  usdRates?: Record<string, number>,
  jpyRates?: Record<string, number>
): { rate: number; available: boolean } {
  const directJpyGbp = jpyRates?.GBP;
  if (typeof directJpyGbp === 'number' && Number.isFinite(directJpyGbp) && directJpyGbp > 0) {
    return { rate: directJpyGbp, available: true };
  }

  const usdToGbp = usdRates?.GBP;
  const usdToJpy = usdRates?.JPY;
  if (
    typeof usdToGbp === 'number' &&
    typeof usdToJpy === 'number' &&
    Number.isFinite(usdToGbp) &&
    Number.isFinite(usdToJpy) &&
    usdToGbp > 0 &&
    usdToJpy > 0
  ) {
    return { rate: usdToGbp / usdToJpy, available: true };
  }

  return { rate: 0, available: false };
}

/**
 * Calculates the single final GBP price for a Japanese dealer vehicle using
 * DEALER_PRICING_CONFIG and our existing live ExchangeRate-API rates.
 */
export function calculateDealerGbpPrice(
  carPriceJpy: number,
  usdRates?: Record<string, number>,
  jpyRates?: Record<string, number>
): DealerGbpPriceResult {
  const cleanJpy = Math.max(0, Math.round(Number(carPriceJpy) || 0));
  const { AUZIO_FEE_JPY, SHIPPING_UK_JPY, MARGIN_PERCENT } = DEALER_PRICING_CONFIG;

  const subtotalJpy = cleanJpy + AUZIO_FEE_JPY + SHIPPING_UK_JPY;
  const finalJpy = cleanJpy > 0 ? Math.round(subtotalJpy * (1 + MARGIN_PERCENT / 100)) : 0;

  const { rate, available } = resolveJpyToGbpRate(usdRates, jpyRates);
  const finalGbp = available && finalJpy > 0 ? Math.round(finalJpy * rate) : 0;

  return {
    carPriceJpy: cleanJpy,
    auzioFeeJpy: AUZIO_FEE_JPY,
    shippingUkJpy: SHIPPING_UK_JPY,
    marginPercent: MARGIN_PERCENT,
    finalJpy,
    finalGbp,
    jpyToGbpRate: rate,
    rateAvailable: available && finalGbp > 0,
  };
}

export function formatGbpAmount(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

export function formatJpyAmount(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('en-US')}`;
}

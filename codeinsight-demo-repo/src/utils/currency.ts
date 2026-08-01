export interface CurrencyConversionOptions {
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate?: number;
}

const DEFAULT_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.35,
};

export function convertCurrency(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): number {
  if (sourceCurrency === targetCurrency) {
    return Math.round(amount * 100) / 100;
  }

  const sourceRate = DEFAULT_RATES[sourceCurrency] ?? 1.0;
  const targetRate = DEFAULT_RATES[targetCurrency] ?? 1.0;

  const inUsd = amount / sourceRate;
  const converted = inUsd * targetRate;

  return Math.round(converted * 100) / 100;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  const formattedAmount = amount.toFixed(2);
  switch (currency.toUpperCase()) {
    case "EUR":
      return `€${formattedAmount}`;
    case "GBP":
      return `£${formattedAmount}`;
    case "CAD":
      return `CA$${formattedAmount}`;
    case "USD":
    default:
      return `$${formattedAmount}`;
  }
}

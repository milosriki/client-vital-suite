import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "AED" | "USD" | "EUR" | "SAR" | "GBP";

// Default fallback rates (used if database rates unavailable)
const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  AED: 1,
  USD: 0.27,
  EUR: 0.25,
  SAR: 1.02,
  GBP: 0.22,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  AED: "AED",
  USD: "$",
  EUR: "€",
  SAR: "SAR",
  GBP: "£",
};

export const useCurrency = () => {
  const queryClient = useQueryClient();

  // Fetch exchange rates from database (with fallback to defaults)
  const { data: exchangeRates = DEFAULT_EXCHANGE_RATES } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_preferences")
        .select("preference_value")
        .eq("preference_key", "exchange_rates")
        .single();
      if (error || !data) return DEFAULT_EXCHANGE_RATES;
      try {
        const rates = JSON.parse(data.preference_value as string);
        return { ...DEFAULT_EXCHANGE_RATES, ...rates } as Record<Currency, number>;
      } catch {
        return DEFAULT_EXCHANGE_RATES;
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  const { data: baseCurrency = "AED" } = useQuery({
    queryKey: ["base-currency"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_preferences")
        .select("preference_value")
        .eq("preference_key", "base_currency")
        .single();
      if (error) return "AED";
      return (JSON.parse(data.preference_value as string) as Currency) || "AED";
    },
  });

  const setCurrency = useMutation({
    mutationFn: async (currency: Currency) => {
      const { error } = await supabase
        .from("system_preferences")
        .upsert({ 
          preference_key: "base_currency", 
          preference_value: JSON.stringify(currency),
          updated_at: new Date().toISOString()
        }, { onConflict: "preference_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["base-currency"] });
    },
  });

  const convertAmount = (amountInAED: number, fromCurrency: Currency = "AED"): number => {
    // Convert from source currency to AED, then to target currency
    const rates = exchangeRates;
    const amountInAEDBase = fromCurrency === "AED" ? amountInAED : amountInAED / rates[fromCurrency];
    return amountInAEDBase * rates[baseCurrency as Currency];
  };

  const formatAmount = (amountInAED: number, originalCurrency?: Currency): string => {
    const converted = convertAmount(amountInAED);
    const symbol = CURRENCY_SYMBOLS[baseCurrency as Currency];
    const formatted = converted.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    // For AED and SAR, put symbol after number
    if (baseCurrency === "AED" || baseCurrency === "SAR") {
      return `${formatted} ${symbol}`;
    }
    return `${symbol}${formatted}`;
  };

  // Mutation to update exchange rates
  const updateRates = useMutation({
    mutationFn: async (newRates: Partial<Record<Currency, number>>) => {
      const updatedRates = { ...exchangeRates, ...newRates };
      const { error } = await supabase
        .from("system_preferences")
        .upsert({
          preference_key: "exchange_rates",
          preference_value: JSON.stringify(updatedRates),
          updated_at: new Date().toISOString()
        }, { onConflict: "preference_key" });
      if (error) throw error;
      return updatedRates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  return {
    baseCurrency: baseCurrency as Currency,
    setCurrency: setCurrency.mutate,
    updateRates: updateRates.mutate,
    convertAmount,
    formatAmount,
    currencies: Object.keys(DEFAULT_EXCHANGE_RATES) as Currency[],
    symbols: CURRENCY_SYMBOLS,
    rates: exchangeRates,
  };
};

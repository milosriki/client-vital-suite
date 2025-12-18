import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";

export type Currency = "AED" | "USD" | "EUR" | "SAR" | "GBP";

const EXCHANGE_RATES: Record<Currency, number> = {
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

  const { data: baseCurrency = "AED" } = useQuery({
    queryKey: QUERY_KEYS.currency.base,
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currency.base });
    },
  });

  const convertAmount = (amountInAED: number, fromCurrency: Currency = "AED"): number => {
    // Convert from source currency to AED, then to target currency
    const amountInAEDBase = fromCurrency === "AED" ? amountInAED : amountInAED / EXCHANGE_RATES[fromCurrency];
    return amountInAEDBase * EXCHANGE_RATES[baseCurrency as Currency];
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

  return {
    baseCurrency: baseCurrency as Currency,
    setCurrency: setCurrency.mutate,
    convertAmount,
    formatAmount,
    currencies: Object.keys(EXCHANGE_RATES) as Currency[],
    symbols: CURRENCY_SYMBOLS,
    rates: EXCHANGE_RATES,
  };
};

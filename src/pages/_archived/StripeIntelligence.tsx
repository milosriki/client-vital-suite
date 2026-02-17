import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { getAuthHeaders, getEdgeFunctionUrl } from "@/config/api";
import {
  RefreshCw,
  ExternalLink,
  CalendarIcon,
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { getBusinessDate } from "@/lib/date-utils";

// Components & Hooks
import { useStripeTransactions } from "@/components/stripe-intelligence/hooks/useStripeTransactions";
import { StripeMetricsCards } from "@/components/stripe-intelligence/StripeMetricsCards";
import { StripeCharts } from "@/components/stripe-intelligence/StripeCharts";
import { StripeTabs } from "@/components/stripe-intelligence/StripeTabs";
import { StripeIntelligenceGhost } from "@/components/stripe-intelligence/StripeIntelligenceGhost";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const PRESET_RANGES = [
  {
    label: "Today",
    getValue: () => ({ from: getBusinessDate(), to: getBusinessDate() }),
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      from: subDays(getBusinessDate(), 7),
      to: getBusinessDate(),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: subDays(getBusinessDate(), 30),
      to: getBusinessDate(),
    }),
  },
  {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(getBusinessDate()),
      to: getBusinessDate(),
    }),
  },
  {
    label: "Last month",
    getValue: () => ({
      from: startOfMonth(subMonths(getBusinessDate(), 1)),
      to: endOfMonth(subMonths(getBusinessDate(), 1)),
    }),
  },
  {
    label: "Last 3 months",
    getValue: () => ({
      from: subMonths(getBusinessDate(), 3),
      to: getBusinessDate(),
    }),
  },
  {
    label: "This year",
    getValue: () => ({
      from: startOfYear(getBusinessDate()),
      to: getBusinessDate(),
    }),
  },
  { label: "All time", getValue: () => ({ from: undefined, to: undefined }) },
];

export default function StripeIntelligence() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPreset, setSelectedPreset] = useState("All time");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    transactions,
    recentTransactions,
    metrics,
    chartData,
    statusBreakdown,
    isLoading,
    refetch,
    isRefetching,
  } = useStripeTransactions(dateRange, statusFilter);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const formatCurrency = (amount: number, currency = "aed") => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const presetConfig = PRESET_RANGES.find((p) => p.label === preset);
    if (presetConfig) {
      setDateRange(presetConfig.getValue());
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    setIsStreaming(true);

    try {
      const context = {
        metrics,
        recentPayments: recentTransactions.slice(0, 10),
        transactionsCount: transactions.length,
        dateRange: {
          preset: selectedPreset,
          from: dateRange.from?.toISOString(),
          to: dateRange.to?.toISOString(),
          description:
            dateRange.from && dateRange.to
              ? `${format(dateRange.from, "MMM d, yyyy")} to ${format(dateRange.to, "MMM d, yyyy")}`
              : selectedPreset === "All time"
                ? "All time (no date filter)"
                : selectedPreset,
        },
      };

      const response = await fetch(getEdgeFunctionUrl("stripe-payouts-ai"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: "chat",
          message: userMessage,
          context,
          history: chatMessages,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Rate limited",
            description: "Please try again in a moment",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                setChatMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const currency = metrics.currency || "aed";

  // Calculate unique paying customers from transactions
  const payingCustomerIds = new Set(
    transactions
      .filter((t) => t.status === "succeeded" || t.status === "paid")
      .map((t) => t.customer_id)
      .filter(Boolean)
  );
  const payingCustomerCount = payingCustomerIds.size;

  if (isLoading) {
    return <StripeIntelligenceGhost />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/executive-dashboard"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <ArrowUpRight className="h-3 w-3 rotate-180" /> Back to Command
              Center
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Stripe Intelligence Pro</h1>
          <p className="text-muted-foreground">
            Advanced financial analytics & AI insights
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Preset */}
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[160px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_RANGES.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[220px] justify-start"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "All time"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                  setSelectedPreset("Custom");
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Stripe
            </a>
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <StripeMetricsCards
        isLoading={isLoading}
        metrics={metrics}
        payingCustomerCount={payingCustomerCount}
        currency={currency}
        formatCurrency={formatCurrency}
      />

      {/* Charts Row */}
      <StripeCharts
        isLoading={isLoading}
        chartData={chartData}
        statusBreakdown={statusBreakdown}
        currency={currency}
        formatCurrency={formatCurrency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <StripeTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isLoading={isLoading}
            metrics={metrics}
            transactions={transactions}
            payingCustomerCount={payingCustomerCount}
            currency={currency}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>
    </div>
  );
}

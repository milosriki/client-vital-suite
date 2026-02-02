import { Code, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import React from "react";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const getRiskColor = (risk: string) => {
  switch (risk) {
    case "critical":
      return "bg-red-500 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-yellow-500 text-black";
    default:
      return "bg-green-500 text-white";
  }
};

export const getRiskBorder = (risk: string) => {
  switch (risk) {
    case "critical":
      return "border-red-500/50 bg-red-500/10";
    case "high":
      return "border-orange-500/50 bg-orange-500/10";
    case "medium":
      return "border-yellow-500/50 bg-yellow-500/10";
    default:
      return "border-green-500/50 bg-green-500/10";
  }
};

export const getActionIcon = (type: string) => {
  switch (type) {
    case "code_deploy":
      return <Code className="w-4 h-4" />;
    case "intervention":
      return <AlertTriangle className="w-4 h-4" />;
    case "analysis":
      return <TrendingUp className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
};

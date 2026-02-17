import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TruthTriangleProps {
  hubspotValue: number;
  stripeValue: number;
  metaValue: number;
  className?: string;
}

const Node = ({
  label,
  value,
  color,
  x,
  y,
}: {
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
}) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="absolute flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-xl w-32 h-32"
    style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
  >
    <div className={`text-sm font-medium ${color}`}>{label}</div>
    <div className="text-xl font-bold text-white mt-1">
      {new Intl.NumberFormat("en-AE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)}
    </div>
    <div className="text-[10px] text-zinc-300 mt-1 uppercase tracking-widest">
      Revenue
    </div>
  </motion.div>
);

const Connection = ({
  x1,
  y1,
  x2,
  y2,
  isMatch,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMatch: boolean;
}) => {
  // Calculate length and angle
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: length, opacity: 1 }}
      transition={{ delay: 0.5, duration: 1 }}
      className={cn(
        "absolute h-[2px] origin-left",
        isMatch
          ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
      )}
      style={{
        left: x1,
        top: y1,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
};

export function TruthTriangle({
  hubspotValue,
  stripeValue,
  metaValue,
  className,
}: TruthTriangleProps) {
  const containerSize = 400;
  const centerX = containerSize / 2;
  const centerY = containerSize / 2;
  const radius = 120; // Distance from center

  // Positions (Equilateral Triangle)
  // Top (Stripe - Representing Bank/Truth)
  const stripePos = { x: centerX, y: centerY - radius };
  // Bottom Right (HubSpot - CRM)
  const hubspotPos = {
    x: centerX + radius * Math.cos(Math.PI / 6),
    y: centerY + radius * Math.sin(Math.PI / 6),
  };
  // Bottom Left (Meta - Ad Platform)
  const metaPos = {
    x: centerX - radius * Math.cos(Math.PI / 6),
    y: centerY + radius * Math.sin(Math.PI / 6),
  };

  // Matching Logic (Allow 1% variance)
  const isMatch = (a: number, b: number) =>
    Math.abs(a - b) / ((a + b) / 2) < 0.01;

  const stripeHubspotMatch = isMatch(stripeValue, hubspotValue);
  const stripeMetaMatch = isMatch(stripeValue, metaValue);
  const hubspotMetaMatch = isMatch(hubspotValue, metaValue);

  // Center Status
  const allMatch =
    stripeHubspotMatch && stripeMetaMatch && hubspotMetaMatch;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl mb-8",
        className,
      )}
      style={{ width: "100%", height: 500 }}
    >
      {/* Glow Effect */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-tr opacity-20 blur-3xl rounded-full",
          allMatch
            ? "from-emerald-500/20 to-cyan-500/20"
            : "from-red-500/20 to-orange-500/20",
        )}
      />

      {/* Connections */}
      <Connection
        x1={stripePos.x}
        y1={stripePos.y}
        x2={hubspotPos.x}
        y2={hubspotPos.y}
        isMatch={stripeHubspotMatch}
      />
      <Connection
        x1={hubspotPos.x}
        y1={hubspotPos.y}
        x2={metaPos.x}
        y2={metaPos.y}
        isMatch={hubspotMetaMatch}
      />
      <Connection
        x1={metaPos.x}
        y1={metaPos.y}
        x2={stripePos.x}
        y2={stripePos.y}
        isMatch={stripeMetaMatch}
      />

      {/* Nodes */}
      <Node
        label="STRIPE"
        value={stripeValue}
        color="text-indigo-400"
        {...stripePos}
      />
      <Node
        label="HUBSPOT"
        value={hubspotValue}
        color="text-orange-400"
        {...hubspotPos}
      />
      <Node
        label="META"
        value={metaValue}
        color="text-blue-400"
        {...metaPos}
      />

      {/* Center Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className={cn(
          "absolute px-4 py-2 rounded-full border text-xs font-bold tracking-wider uppercase",
          allMatch
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            : "border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
        )}
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        {allMatch ? "UNIVERSAL TRUTH VERIFIED" : "DATA DISCREPANCY DETECTED"}
      </motion.div>
    </div>
  );
}

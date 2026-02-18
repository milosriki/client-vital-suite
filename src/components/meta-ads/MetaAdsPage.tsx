import MetaAdsDashboard from "./MetaAdsDashboard";
import MetaAdsChat from "./MetaAdsChat";

export default function MetaAdsPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6 p-6">
      {/* Dashboard — left 60% */}
      <div className="flex-[3] overflow-y-auto pr-2">
        <MetaAdsDashboard />
      </div>

      {/* Chat — right 40% */}
      <div className="flex-[2] min-w-[380px]">
        <MetaAdsChat />
      </div>
    </div>
  );
}

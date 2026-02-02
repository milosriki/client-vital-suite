import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Shield, Wifi, WifiOff } from "lucide-react";
import { ClientHealthMetrics, IntegrationStatus } from "@/types/ceo";

interface CEOClientHealthProps {
  clientHealth: ClientHealthMetrics | undefined;
  integrationStatus: IntegrationStatus | undefined;
}

export function CEOClientHealth({
  clientHealth,
  integrationStatus,
}: CEOClientHealthProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Client Health Distribution */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" />
            Client Health Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden flex">
              {clientHealth && clientHealth.total > 0 && (
                <>
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(clientHealth.green / clientHealth.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-yellow-500"
                    style={{
                      width: `${(clientHealth.yellow / clientHealth.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${(clientHealth.red / clientHealth.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${(clientHealth.purple / clientHealth.total) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <span className="text-sm text-white/60">
              {clientHealth?.avgHealth || 0} avg
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <p className="text-lg font-bold text-green-400">
                {clientHealth?.green || 0}
              </p>
              <p className="text-xs text-white/40">Green</p>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <p className="text-lg font-bold text-yellow-400">
                {clientHealth?.yellow || 0}
              </p>
              <p className="text-xs text-white/40">Yellow</p>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <p className="text-lg font-bold text-red-400">
                {clientHealth?.red || 0}
              </p>
              <p className="text-xs text-white/40">Red</p>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <p className="text-lg font-bold text-purple-400">
                {clientHealth?.purple || 0}
              </p>
              <p className="text-xs text-white/40">Purple</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(integrationStatus || {}).map(
              ([platform, status]) => (
                <div
                  key={platform}
                  className={`p-3 rounded-lg border ${
                    status.connected && status.errors === 0
                      ? "bg-green-500/10 border-green-500/30"
                      : status.errors > 0
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-yellow-500/10 border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white capitalize">
                      {platform}
                    </span>
                    {status.connected ? (
                      <Wifi className="w-4 h-4 text-green-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {status.errors > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {status.errors} errors
                      </Badge>
                    )}
                    {status.lastSync && (
                      <span className="text-xs text-white/40">
                        {new Date(status.lastSync).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

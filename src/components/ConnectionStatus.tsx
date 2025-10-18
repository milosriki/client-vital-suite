import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function ConnectionStatus() {
  const { status, lastSync } = useConnectionStatus();

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'reconnecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'reconnecting':
        return 'Reconnecting...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-red-500';
      case 'reconnecting':
        return 'text-yellow-500';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {getStatusIcon()}
      <span className={getStatusColor()}>{getStatusText()}</span>
      {status === 'connected' && (
        <span className="text-muted-foreground text-xs">
          • Synced {formatDistanceToNow(lastSync, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

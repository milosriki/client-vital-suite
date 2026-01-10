import { Component, ErrorInfo, ReactNode, type ContextType } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorHandlingContext } from '@/hooks/use-error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * FIXES:
 * - Prevents entire app crash on component errors
 * - Provides graceful fallback UI
 * - Allows recovery without page refresh
 * - Logs errors for debugging
 */
export class ErrorBoundary extends Component<Props, State> {
  public static contextType = ErrorHandlingContext;
  declare context: ContextType<typeof ErrorHandlingContext>;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    this.context?.reportError(error, { context: 'ErrorBoundary', source: 'render', severity: 'high' });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription className="text-muted-foreground">
                An error occurred while rendering this section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message || 'Unknown error'}
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  variant="default" 
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary for individual components
 * Shows a minimal error state inline
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  public static contextType = ErrorHandlingContext;
  declare context: ContextType<typeof ErrorHandlingContext>;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ComponentErrorBoundary] Caught error:', error);
    this.props.onError?.(error, errorInfo);
    this.context?.reportError(error, { context: 'ComponentErrorBoundary', source: 'render', severity: 'medium' });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Failed to load this component
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={this.handleRetry}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

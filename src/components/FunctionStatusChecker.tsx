import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { testAllFunctions, testFunction, type FunctionTestResult } from '@/utils/testFunctions';

export function FunctionStatusChecker() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<FunctionTestResult[]>([]);

  const handleTestAll = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      const testResults = await testAllFunctions();
      setResults(testResults);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Function Status Checker</span>
          <Badge variant={results.length === 0 ? 'secondary' : successCount === results.length ? 'default' : 'destructive'}>
            {results.length > 0 ? `${successCount}/${results.length} Working` : 'Not Tested'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Test all Edge Functions to verify they're connected and working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleTestAll} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Functions...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Test All Functions
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Results: {successCount} ✅ | {failCount} ❌
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {results.map((result, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2 rounded border text-sm"
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-mono">{result.functionName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{result.duration}ms</span>
                    {result.error && (
                      <span className="text-red-500" title={result.error}>
                        Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, CheckCircle2, X } from "lucide-react";
import { detectTestData, clearTestData } from "@/utils/detectTestData";
import { toast } from "@/hooks/use-toast";

export function TestDataAlert() {
  const [hasTestData, setHasTestData] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [testDataInfo, setTestDataInfo] = useState<{
    testDataCount: number;
    sources: string[];
  } | null>(null);

  useEffect(() => {
    checkForTestData();
  }, []);

  const checkForTestData = async () => {
    setIsChecking(true);
    try {
      const result = await detectTestData();
      setHasTestData(result.hasTestData);
      setTestDataInfo({
        testDataCount: result.testDataCount,
        sources: result.sources
      });
    } catch (error) {
      console.error('Failed to check for test data:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearTestData = async () => {
    setIsClearing(true);
    setShowConfirmDialog(false);
    
    try {
      const result = await clearTestData();
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        setHasTestData(false);
        setTestDataInfo(null);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear test data",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Don't show anything if still checking or if dismissed
  if (isChecking || isDismissed) {
    return null;
  }

  // Don't show if no test data
  if (!hasTestData) {
    return null;
  }

  return (
    <>
      <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
            <div className="flex-1">
              <AlertTitle className="text-amber-900 dark:text-amber-100 mb-2">
                Test/Mock Data Detected in Production
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-2">
                <p>
                  Your database contains test data that should not be in production.
                  {testDataInfo && testDataInfo.sources.length > 0 && (
                    <>
                      {' '}Found in: <strong>{testDataInfo.sources.join(', ')}</strong>
                    </>
                  )}
                </p>
                <p className="text-sm">
                  Click "Clear & Sync" to remove test data and sync real data from HubSpot.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isClearing}
                    variant="default"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Clear & Sync from HubSpot
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setIsDismissed(true)}
                    variant="outline"
                    size="sm"
                    className="border-amber-600 text-amber-900 dark:text-amber-100"
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </div>
          <Button
            onClick={() => setIsDismissed(true)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Test Data & Sync from HubSpot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all test/fake data (emails ending with @example.com, @email.com, or @test.com)
              and sync fresh data from HubSpot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearTestData}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

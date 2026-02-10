import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, ScanEye, Utensils, Activity } from "lucide-react";

export function VisionAnalysisWidget() {
  const [imageUrl, setImageUrl] = useState("");
  const [analysisType, setAnalysisType] = useState<
    "general" | "meal" | "form_check"
  >("general");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "vision-analytics",
        {
          body: { imageUrl, type: analysisType },
        },
      );

      if (error) throw error;
      setResult(data?.analysis);
    } catch (err) {
      console.error("Vision Error:", err);
      setResult({
        error: "Failed to analyze image. Ensure URL is publicly accessible.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ScanEye className="h-4 w-4 text-indigo-500" />
            Vision Analytics
          </CardTitle>
          {analyzing && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <CardDescription className="text-xs">
          Multimodal AI analysis for meals & form checks.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-xs">Image Source URL</Label>
          <div className="flex gap-2">
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/meal.jpg"
              className="h-8 text-xs bg-secondary/50 border-border"
            />
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || !imageUrl}
              className="h-8 bg-indigo-600 hover:bg-indigo-700"
            >
              Analyze
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue="general"
          className="w-full"
          onValueChange={(v) => setAnalysisType(v as any)}
        >
          <TabsList className="grid w-full grid-cols-3 bg-secondary/30 h-8">
            <TabsTrigger value="general" className="text-xs">
              General
            </TabsTrigger>
            <TabsTrigger value="meal" className="text-xs flex gap-1">
              <Utensils className="w-3 h-3" /> Meal
            </TabsTrigger>
            <TabsTrigger value="form_check" className="text-xs flex gap-1">
              <Activity className="w-3 h-3" /> Form
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Results Area */}
        <div className="min-h-[150px] bg-black/20 rounded-md border border-border/50 p-3 text-xs font-mono overflow-auto">
          {analyzing ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <ScanEye className="w-8 h-8 animate-pulse opacity-50" />
              <span>Analyzing pixels with Gemini 1.5 Pro...</span>
            </div>
          ) : result ? (
            <pre className="whitespace-pre-wrap text-emerald-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
              <Upload className="w-6 h-6 mb-2" />
              <span>Enter URL to start analysis</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

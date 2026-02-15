import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Zap,
  Shield,
  MessageCircle,
  Target,
  Users,
  Heart,
  Search,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { PageSkeleton } from "@/components/ui/page-skeleton";

// The 7 Core Skills for Booking Agent (Lisa) — static definitions
const SKILL_DEFS = [
  { id: "opener", name: "The Opener", icon: Zap, category: "Speed" },
  { id: "qualification", name: "Qualification", icon: Search, category: "IQ" },
  { id: "booking", name: "Strategic Booking", icon: Target, category: "Sales" },
  {
    id: "objection",
    name: "Objection Handling",
    icon: Shield,
    category: "Sales",
  },
  { id: "eq", name: "Emotional Intelligence", icon: Heart, category: "EQ" },
  {
    id: "followup",
    name: "Proactive Follow-Up",
    icon: Users,
    category: "Sales",
  },
  {
    id: "tone",
    name: "Tone (Big Sister)",
    icon: MessageCircle,
    category: "EQ",
  },
];

interface TestResult {
  response: string;
  score: number;
  analysis: string;
  status: string;
}

export default function SkillCommandCenter() {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // ── LIVE DATA: Fetch skill audit results from agent_knowledge ──
  const {
    data: auditData,
    isLoading: auditsLoading,
    refetch: refetchAudits,
  } = useDedupedQuery({
    queryKey: ["skill-audit-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_knowledge")
        .select("id, title, content, source, category, structured_data, created_at")
        .eq("source", "atlas_audit")
        .eq("category", "learning")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ── LIVE DATA: Fetch recent audit scores for the radar chart ──
  const { data: recentAudits, isLoading: scoresLoading } = useDedupedQuery({
    queryKey: ["skill-recent-audits"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "ptd-skill-auditor",
        {
          body: { limit: 10 },
        },
      );
      if (error) {
        // If EF fails, just return empty — the UI will show "no data" gracefully
        console.warn("Skill auditor fetch:", error);
        return null;
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // ── Derive live skill scores from audit data ──
  const skillScores = (() => {
    const scores: Record<string, { total: number; count: number }> = {};
    // Process stored audit lessons for per-weakness scoring
    const lessons = (auditData as unknown[]) || [];
    lessons.forEach((lesson: unknown) => {
      const auditLesson = lesson as {
        title?: string;
        structured_data?: { score?: number };
      };
      const weakness =
        auditLesson.title?.replace("Improvement: ", "")?.toLowerCase() || "";
      const score = auditLesson.structured_data?.score || 0;
      // Map weakness to skill IDs
      const skillMap: Record<string, string> = {
        "the opener": "opener",
        qualification: "qualification",
        "strategic booking": "booking",
        "objection handling": "objection",
        "emotional intelligence": "eq",
        "proactive follow-up": "followup",
        tone: "tone",
        "tone (big sister)": "tone",
      };
      const skillId = skillMap[weakness] || "booking"; // default
      if (!scores[skillId]) scores[skillId] = { total: 0, count: 0 };
      scores[skillId].total += score;
      scores[skillId].count += 1;
    });
    return scores;
  })();

  // Build skill list with live levels
  const SKILLS = SKILL_DEFS.map((def) => {
    const scoreData = skillScores[def.id];
    const level =
      scoreData && scoreData.count > 0
        ? Math.round(scoreData.total / scoreData.count)
        : null; // null = no data yet
    return { ...def, level };
  });

  // Build radar chart data from live skills
  const radarData = [
    {
      subject: "Speed",
      A: SKILLS.find((s) => s.id === "opener")?.level ?? 0,
      fullMark: 100,
    },
    {
      subject: "IQ (Filter)",
      A: SKILLS.find((s) => s.id === "qualification")?.level ?? 0,
      fullMark: 100,
    },
    {
      subject: "Closing",
      A: SKILLS.find((s) => s.id === "booking")?.level ?? 0,
      fullMark: 100,
    },
    {
      subject: "Empathy",
      A: SKILLS.find((s) => s.id === "eq")?.level ?? 0,
      fullMark: 100,
    },
    {
      subject: "Persistence",
      A: SKILLS.find((s) => s.id === "followup")?.level ?? 0,
      fullMark: 100,
    },
  ];

  const avgScore =
    SKILLS.filter((s) => s.level !== null).length > 0
      ? Math.round(
          SKILLS.filter((s) => s.level !== null).reduce(
            (sum: number, s) => sum + (s.level || 0),
            0,
          ) / SKILLS.filter((s) => s.level !== null).length,
        )
      : null;

  const iqAvg = Math.round(
    [
      SKILLS.find((s) => s.id === "qualification")?.level,
      SKILLS.find((s) => s.id === "opener")?.level,
    ]
      .filter(Boolean)
      .reduce((a: number, b) => (a || 0) + (b || 0), 0)! /
      [
        SKILLS.find((s) => s.id === "qualification")?.level,
        SKILLS.find((s) => s.id === "opener")?.level,
      ].filter(Boolean).length || 1,
  );
  const salesAvg = Math.round(
    [
      SKILLS.find((s) => s.id === "booking")?.level,
      SKILLS.find((s) => s.id === "objection")?.level,
      SKILLS.find((s) => s.id === "followup")?.level,
    ]
      .filter(Boolean)
      .reduce((a: number, b) => (a || 0) + (b || 0), 0)! /
      [
        SKILLS.find((s) => s.id === "booking")?.level,
        SKILLS.find((s) => s.id === "objection")?.level,
        SKILLS.find((s) => s.id === "followup")?.level,
      ].filter(Boolean).length || 1,
  );

  // ── REAL: Run skill test via ptd-skill-auditor EF ──
  const runSkillTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "ptd-skill-auditor",
        {
          body: { limit: 1 },
        },
      );

      if (error) throw error;

      if (data?.audits?.length > 0) {
        const grading = data.audits[0].grading;
        setTestResult({
          response: grading.lesson || "No lesson generated",
          score: grading.score || 0,
          analysis: grading.analysis || "No analysis available",
          status: (grading.score || 0) >= 70 ? "pass" : "fail",
        });
        toast.success("Skill Audit Completed — Real AI Grading");
        // Refresh the audit data to show new results
        refetchAudits();
      } else {
        setTestResult({
          response: "No recent interactions found to audit.",
          score: 0,
          analysis: "No WhatsApp interactions available for grading.",
          status: "no_data",
        });
        toast.info("No interactions to audit yet");
      }
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(`Audit failed: ${error.message || "Unknown error"}`);
      setTestResult({
        response: "Error running audit",
        score: 0,
        analysis: error.message || "Unknown error",
        status: "error",
      });
    } finally {
      setTesting(false);
    }
  };

  const isLoading = auditsLoading || scoresLoading;

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-500" />
            Skill Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            The "Power Generator" for AI Capability. Train, Test, and Upgrade.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">
              Vitality Score
            </p>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold text-green-500">
                {avgScore !== null ? `${avgScore}/100` : "—"}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchAudits()}
            disabled={isLoading}
          >
            <RotateCcw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: POWER MATRIX */}
        <Card className="lg:col-span-1 bg-gradient-to-b from-background to-muted/20">
          <CardHeader>
            <CardTitle>Power Matrix</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading live data..."
                : "Live Capability Distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={radarData}
                >
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Lisa"
                    dataKey="A"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>IQ Level</span>
                <span className="font-bold text-blue-500">
                  {isLoading ? "..." : iqAvg ? `${iqAvg}/100` : "—"}
                </span>
              </div>
              <Progress
                value={iqAvg || 0}
                className="h-2 bg-blue-950"
                indicatorClassName="bg-blue-500"
              />

              <div className="flex justify-between text-sm mt-2">
                <span>Sales Capability</span>
                <span className="font-bold text-green-500">
                  {isLoading ? "..." : salesAvg ? `${salesAvg}/100` : "—"}
                </span>
              </div>
              <Progress
                value={salesAvg || 0}
                className="h-2 bg-green-950"
                indicatorClassName="bg-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: SKILL GRID */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="all">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="all">All Skills</TabsTrigger>
                <TabsTrigger value="critical">Critical</TabsTrigger>
                <TabsTrigger value="history">Audit History</TabsTrigger>
              </TabsList>
              <Badge variant="outline" className="text-xs">
                {Array.isArray(auditData) ? auditData.length : 0} audits stored
              </Badge>
            </div>

            <TabsContent value="all" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SKILLS.map((skill) => (
                  <Card
                    key={skill.id}
                    className="hover:border-primary/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedSkill(skill.id)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-lg ${
                            skill.level === null
                              ? "bg-muted/50 text-muted-foreground"
                              : skill.level > 80
                                ? "bg-green-500/10 text-green-500"
                                : skill.level > 60
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          <skill.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {skill.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {skill.category} •{" "}
                            {skill.level !== null
                              ? `Lvl ${skill.level}`
                              : "No data"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 hidden sm:block">
                          <Progress
                            value={skill.level || 0}
                            className="h-1.5"
                          />
                        </div>
                        <Button size="sm" variant="secondary" className="h-8">
                          Check
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="critical" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SKILLS.filter((s) => s.level !== null && s.level < 70).map(
                  (skill) => (
                    <Card
                      key={skill.id}
                      className="hover:border-red-500/50 transition-colors cursor-pointer border-red-500/20"
                      onClick={() => setSelectedSkill(skill.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                            <skill.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-red-400">
                              {skill.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              ⚠️ Below threshold • Lvl {skill.level}
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          Needs Training
                        </Badge>
                      </CardContent>
                    </Card>
                  ),
                )}
                {SKILLS.filter((s) => s.level !== null && s.level < 70)
                  .length === 0 && (
                  <div className="col-span-2 py-8">
                    {isLoading
                      ? <PageSkeleton variant="cards" count={2} />
                      : <p className="text-center text-muted-foreground">No critical skills detected. All skills are above threshold or have no data yet.</p>}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {(Array.isArray(auditData) ? auditData : [])
                    .slice(0, 20)
                    .map((audit: unknown, i: number) => {
                      const auditItem = audit as {
                        title: string;
                        content: string;
                        structured_data?: { score?: number };
                        created_at: string;
                      };
                      return (
                        <Card key={i} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-medium text-sm">
                                  {auditItem.title}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {auditItem.content}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  (auditItem.structured_data?.score || 0) >= 80
                                    ? "default"
                                    : (auditItem.structured_data?.score || 0) >= 60
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {auditItem.structured_data?.score || "—"}/100
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {new Date(auditItem.created_at).toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  {(Array.isArray(auditData) ? auditData.length : 0) === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      {isLoading
                        ? "Loading audit history..."
                        : "No audit history yet. Run a skill check to get started."}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* TEST ARENA DIALOG */}
      <Dialog
        open={!!selectedSkill}
        onOpenChange={(open) => !open && setSelectedSkill(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Skill Capability Check:{" "}
              {SKILLS.find((s) => s.id === selectedSkill)?.name}
            </DialogTitle>
            <DialogDescription>
              Run a live AI audit on recent conversations to evaluate this
              skill. The ptd-skill-auditor will grade Lisa's real interactions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="prompt"
                placeholder="e.g., 'This is too expensive for me...'"
                className="col-span-3"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />
              <Button onClick={runSkillTest} disabled={testing}>
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                    Auditing...
                  </>
                ) : (
                  "Run Audit"
                )}
              </Button>
            </div>

            {testResult && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-semibold mb-1 text-muted-foreground">
                    AI Lesson:
                  </p>
                  <p className="text-sm italic">"{testResult.response}"</p>
                </div>

                <div
                  className={`p-4 rounded-lg border flex items-start gap-3 ${
                    testResult.score >= 70
                      ? "bg-green-500/10 border-green-500/20"
                      : testResult.status === "no_data"
                        ? "bg-blue-500/10 border-blue-500/20"
                        : "bg-red-500/10 border-red-500/20"
                  }`}
                >
                  {testResult.score >= 70 ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : testResult.status === "no_data" ? (
                    <Brain className="h-5 w-5 text-blue-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <h4
                      className={`font-bold ${
                        testResult.score >= 70
                          ? "text-green-600"
                          : testResult.status === "no_data"
                            ? "text-blue-600"
                            : "text-red-600"
                      }`}
                    >
                      {testResult.status === "no_data"
                        ? "No Data Available"
                        : `Score: ${testResult.score}/100 (${testResult.status.toUpperCase()})`}
                    </h4>
                    <p className="text-sm mt-1">{testResult.analysis}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

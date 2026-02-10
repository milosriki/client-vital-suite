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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// The 10 Core Skills from Catalog
// The 7 Core Skills for Booking Agent (Lisa)
const SKILLS = [
  {
    id: "opener",
    name: "The Opener",
    icon: Zap,
    category: "Speed",
    level: 92,
  },
  {
    id: "qualification",
    name: "Qualification",
    icon: Search,
    category: "IQ",
    level: 85,
  },
  {
    id: "booking",
    name: "Strategic Booking",
    icon: Target,
    category: "Sales",
    level: 72,
  },
  {
    id: "objection",
    name: "Objection Handling",
    icon: Shield,
    category: "Sales",
    level: 78,
  },
  {
    id: "eq",
    name: "Emotional Intelligence",
    icon: Heart,
    category: "EQ",
    level: 65,
  },
  {
    id: "followup",
    name: "Proactive Follow-Up",
    icon: Users,
    category: "Sales",
    level: 40,
  },
  {
    id: "tone",
    name: "Tone (Big Sister)",
    icon: MessageCircle,
    category: "EQ",
    level: 92,
  },
];

const DATA = [
  { subject: "Speed", A: 92, fullMark: 100 },
  { subject: "IQ (Filter)", A: 85, fullMark: 100 },
  { subject: "Closing", A: 75, fullMark: 100 },
  { subject: "Empathy", A: 78, fullMark: 100 },
  { subject: "Persistence", A: 40, fullMark: 100 },
];

export default function SkillCommandCenter() {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Mock Test Function (will connect to ptd-skill-auditor later)
  const runSkillTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock Response for now
      setTestResult({
        response:
          "I understand you're hesitant about the price. However, consider the value of...",
        score: 85,
        analysis:
          "Good empathy, but missed the 'Group Class' downsell opportunity.",
        status: "pass",
      });
      toast.success("Skill Test Completed");
    } catch (e) {
      toast.error("Test Failed");
    } finally {
      setTesting(false);
    }
  };

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
            <p className="text-2xl font-bold text-green-500">87/100</p>
          </div>
          <Button variant="outline" size="icon">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: POWER MATRIX */}
        <Card className="lg:col-span-1 bg-gradient-to-b from-background to-muted/20">
          <CardHeader>
            <CardTitle>Power Matrix</CardTitle>
            <CardDescription>Current Capability Distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={DATA}>
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
                <span className="font-bold text-blue-500">89/100</span>
              </div>
              <Progress
                value={89}
                className="h-2 bg-blue-950"
                indicatorColor="bg-blue-500"
              />

              <div className="flex justify-between text-sm mt-2">
                <span>Sales Capability</span>
                <span className="font-bold text-green-500">65/100</span>
              </div>
              <Progress
                value={65}
                className="h-2 bg-green-950"
                indicatorColor="bg-green-500"
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
                <TabsTrigger value="sales">Sales</TabsTrigger>
              </TabsList>
              <Button size="sm" variant="ghost">
                View Catalog
              </Button>
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
                          className={`p-2 rounded-lg ${skill.level > 80 ? "bg-green-500/10 text-green-500" : skill.level > 60 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}
                        >
                          <skill.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {skill.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {skill.category} • Lvl {skill.level}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 hidden sm:block">
                          <Progress value={skill.level} className="h-1.5" />
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
              Enter a user prompt to test this specific skill. The Agent will
              respond without memory of this test.
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
                {testing ? "Testing..." : "Run Check"}
              </Button>
            </div>

            {testResult && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-semibold mb-1 text-muted-foreground">
                    AI Response:
                  </p>
                  <p className="text-sm italic">"{testResult.response}"</p>
                </div>

                <div
                  className={`p-4 rounded-lg border flex items-start gap-3 ${testResult.score >= 80 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}
                >
                  {testResult.score >= 80 ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <h4
                      className={`font-bold ${testResult.score >= 80 ? "text-green-600" : "text-red-600"}`}
                    >
                      Score: {testResult.score}/100 (
                      {testResult.status.toUpperCase()})
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

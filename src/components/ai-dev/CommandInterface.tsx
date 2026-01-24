import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Terminal, Rocket, Loader2, Command } from "lucide-react";

interface CommandInterfaceProps {
  command: string;
  setCommand: (value: string) => void;
  executeCommand: any;
}

const quickCommands = [
  {
    label: "Check Health Scores",
    command:
      "Analyze the current health score distribution and identify any calculation issues",
  },
  {
    label: "Analyze Churn Risk",
    command:
      "Review clients at risk of churn and suggest intervention strategies",
  },
  {
    label: "Coach Performance",
    command: "Generate a coach performance summary with AI recommendations",
  },
  {
    label: "Create Component",
    command: "Create a new React component for displaying",
  },
  { label: "Add Database Table", command: "Design a new Supabase table for" },
  {
    label: "Optimize Query",
    command: "Review and optimize the database queries in",
  },
];

export const CommandInterface = ({
  command,
  setCommand,
  executeCommand,
}: CommandInterfaceProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      executeCommand.mutate(command);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setCommand(cmd);
  };

  return (
    <Card className="premium-card border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Command Center</CardTitle>
            <CardDescription>
              Give instructions in natural language
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., 'Create a new page called CoachAnalytics that displays coach performance metrics with charts'"
              className="min-h-[100px] resize-none bg-background/50 border-border/50 font-mono text-sm pr-24"
            />
            <Button
              type="submit"
              className="absolute bottom-3 right-3 gap-2 shadow-glow-sm"
              disabled={executeCommand.isPending || !command.trim()}
            >
              {executeCommand.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Execute
            </Button>
          </div>

          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((qc) => (
              <Button
                key={qc.label}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1 hover:bg-primary/10 hover:border-primary/30"
                onClick={() => handleQuickCommand(qc.command)}
              >
                <Command className="h-3 w-3" />
                {qc.label}
              </Button>
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

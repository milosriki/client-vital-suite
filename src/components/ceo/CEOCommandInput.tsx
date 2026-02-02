import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, Brain, Loader2 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface CEOCommandInputProps {
  command: string;
  setCommand: (cmd: string) => void;
  generateSolution: UseMutationResult<void, Error, string, unknown>;
}

export function CEOCommandInput({
  command,
  setCommand,
  generateSolution,
}: CEOCommandInputProps) {
  return (
    <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          <span className="text-sm sm:text-base lg:text-xl">
            Request New Feature / Solution
          </span>
        </h2>
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder='Examples:
• "Build a churn prediction dashboard with ML"
• "Create WhatsApp booking integration"
• "Fix the Stripe payment sync issue"
• "Add automated follow-up for stale leads"'
          className="bg-white/5 border-white/20 text-white placeholder-white/40 min-h-[100px] mb-4 focus:border-cyan-500 text-sm sm:text-base"
        />
        <Button
          onClick={() => generateSolution.mutate(command)}
          disabled={!command.trim() || generateSolution.isPending}
          className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 h-10 sm:h-12 text-sm sm:text-lg"
        >
          {generateSolution.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing & Generating...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5 mr-2" />
              Generate Solution (Claude + Gemini)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

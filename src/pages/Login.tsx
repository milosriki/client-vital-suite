import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Welcome back",
        description: "Successfully logged in",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background gradient-mesh p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

      <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10 glass-card animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            PTD Fitness
          </CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Enter your credentials to access the command center
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-muted-foreground">
            <p>Protected by PTD Intelligence Suite</p>
          </div>
        </CardContent>
      </Card>

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[96px] animate-pulse"
          style={{ animationDuration: "6s" }}
        />
      </div>
    </div>
  );
}

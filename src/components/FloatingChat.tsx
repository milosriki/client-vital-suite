import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Minimize2,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Brain,
  Sparkles,
  RefreshCw,
  Zap,
  Database,
  ChevronDown,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getThreadId, startNewThread } from "@/lib/ptd-memory";
import { getThreadId, startNewThread } from "@/lib/ptd-memory";
import { getApiUrl, API_ENDPOINTS, getAuthHeaders } from "@/config/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; type: string }[];
  timestamp: Date;
  isStreaming?: boolean;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

export const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "error"
  >("connected");
  const [memoryCount, setMemoryCount] = useState(0);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer for loading state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingSeconds(0);
      interval = setInterval(() => {
        setLoadingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Initialize thread and load memory stats
  useEffect(() => {
    setThreadId(getThreadId());
    loadMemoryStats();
  }, []);

  const loadMemoryStats = async () => {
    try {
      const { count } = await supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true });
      setMemoryCount(count || 0);
    } catch {
      // Non-critical
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleNewThread = () => {
    const newId = startNewThread();
    setThreadId(newId);
    setMessages([]);
    setUploadedFiles([]);
    toast({ title: "New conversation started" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const content = await readFileContent(file);
        newFiles.push({
          name: file.name,
          type: file.type || getFileType(file.name),
          content,
        });
      } catch (error) {
        console.error("Error reading file:", error);
        toast({
          title: "Error reading file",
          description: `Could not read ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files attached",
      description: `${newFiles.length} file(s) ready to analyze`,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileType = file.type || getFileType(file.name);

      if (
        fileType.includes("pdf") ||
        fileType.includes("excel") ||
        fileType.includes("spreadsheet") ||
        fileType.includes("csv") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")
      ) {
        reader.onload = () => {
          const base64 = btoa(
            new Uint8Array(reader.result as ArrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              "",
            ),
          );
          resolve(`[BASE64:${file.name}]${base64}`);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      json: "application/json",
      txt: "text/plain",
      md: "text/markdown",
    };
    return types[ext || ""] || "text/plain";
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-3 w-3" />;
    if (
      type.includes("excel") ||
      type.includes("spreadsheet") ||
      type.includes("csv")
    )
      return <FileSpreadsheet className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage = input.trim();
    const files = [...uploadedFiles];

    setInput("");
    setUploadedFiles([]);
    setConnectionStatus("connecting");

    const displayMessage =
      userMessage || `Analyzing ${files.length} file(s)...`;
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: displayMessage,
        files: files.map((f) => ({ name: f.name, type: f.type })),
        timestamp: new Date(),
      },
    ]);

    // Add placeholder for assistant response
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    setIsLoading(true);

    try {
      const fileContents = files.map((f) => ({
        name: f.name,
        type: f.type,
        content: f.content,
      }));

      const messageWithFiles =
        files.length > 0
          ? `${userMessage}\n\n[UPLOADED FILES]\n${files.map((f) => `- ${f.name}`).join("\n")}\n\n[FILE CONTENTS]\n${fileContents.map((f) => `=== ${f.name} ===\n${f.content.slice(0, 50000)}`).join("\n\n")}`
          : userMessage;

      console.log(
        "📤 Sending to agent via edge function:",
        userMessage.slice(0, 50),
      );

      const response = await fetch(getApiUrl(API_ENDPOINTS.agent), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: messageWithFiles,
          thread_id: threadId,
          has_files: files.length > 0,
          file_names: files.map((f) => f.name),
        }),
      });

      const json = await response.json().catch(() => ({}));
      console.log("📥 Agent response:", { status: response.status, json });

      if (!response.ok) {
        const errMsg = json?.error || json?.message || "Failed to get response";
        throw new Error(errMsg);
      }

      const responseText =
        json?.response ||
        json?.answer ||
        json?.message ||
        "No response received. Please try again.";

      // Update assistant message with response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: responseText, isStreaming: false }
            : msg,
        ),
      );

      setConnectionStatus("connected");
      loadMemoryStats();

      toast({
        title: "Response received",
        description: `Processed in ${json?.duration_ms ? Math.round(json.duration_ms / 1000) + "s" : "a moment"}`,
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg =
        error?.message || "Sorry, I encountered an error. Please try again.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `❌ Error: ${errorMsg}\n\nPlease try again or simplify your question.`,
                isStreaming: false,
              }
            : msg,
        ),
      );
      setConnectionStatus("error");

      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, uploadedFiles, isLoading, threadId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 border-2 border-cyan-400/50 animate-pulse"
        size="icon"
      >
        <Brain className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl transition-all duration-300 backdrop-blur-xl",
        isMinimized
          ? "bottom-6 right-6 w-72 h-14"
          : isExpanded
            ? "inset-4"
            : "bottom-6 right-6 w-[420px] h-[600px]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-slate-800/80 to-slate-900/80 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="h-6 w-6 text-cyan-400" />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900",
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500",
              )}
            />
          </div>
          <div>
            <span className="font-semibold text-sm text-white">PTD Agent</span>
            <div className="flex items-center gap-2 text-[10px] text-cyan-400/70">
              <Zap className="w-3 h-3" />
              <span>Self-Learning AI</span>
              {memoryCount > 0 && (
                <>
                  <Database className="w-3 h-3 ml-1" />
                  <span>{memoryCount}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
            onClick={handleNewThread}
            title="New conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize" : "Expand"}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/70 hover:text-white hover:bg-red-500/20"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="relative inline-block mb-4">
                  <Brain className="h-14 w-14 text-cyan-400/50 mx-auto" />
                  <Sparkles className="h-5 w-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <p className="text-white/80 font-medium mb-1">
                  PTD Super-Intelligence
                </p>
                <p className="text-cyan-400/70 text-xs mb-4">
                  Ask anything about your business data
                </p>

                {/* Quick Action Buttons - Row 1 */}
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  <button
                    onClick={() => {
                      setInput("Show my Stripe balance and recent payments");
                    }}
                    className="px-3 py-1.5 text-xs bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 hover:bg-purple-500/30 transition-colors"
                  >
                    💳 Stripe Balance
                  </button>
                  <button
                    onClick={() => {
                      setInput("Scan Stripe for fraud or suspicious activity");
                    }}
                    className="px-3 py-1.5 text-xs bg-red-500/20 border border-red-500/30 rounded-full text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    🔍 Fraud Scan
                  </button>
                  <button
                    onClick={() => {
                      setInput("Show clients at risk of churning");
                    }}
                    className="px-3 py-1.5 text-xs bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300 hover:bg-orange-500/30 transition-colors"
                  >
                    ⚠️ At-Risk
                  </button>
                </div>

                {/* Quick Action Buttons - Row 2 */}
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  <button
                    onClick={() => {
                      setInput("Coach performance ranking");
                    }}
                    className="px-3 py-1.5 text-xs bg-green-500/20 border border-green-500/30 rounded-full text-green-300 hover:bg-green-500/30 transition-colors"
                  >
                    📊 Coaches
                  </button>
                  <button
                    onClick={() => {
                      setInput("Show sales pipeline summary");
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 hover:bg-blue-500/30 transition-colors"
                  >
                    💰 Pipeline
                  </button>
                  <button
                    onClick={() => {
                      setInput("Run business intelligence report");
                    }}
                    className="px-3 py-1.5 text-xs bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                  >
                    🧠 BI Report
                  </button>
                </div>

                {/* Quick Action Buttons - Row 3 */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  <button
                    onClick={() => {
                      setInput("Check live calls status");
                    }}
                    className="px-3 py-1.5 text-xs bg-teal-500/20 border border-teal-500/30 rounded-full text-teal-300 hover:bg-teal-500/30 transition-colors"
                  >
                    📞 Live Calls
                  </button>
                  <button
                    onClick={() => {
                      setInput("Run proactive system scan");
                    }}
                    className="px-3 py-1.5 text-xs bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-300 hover:bg-yellow-500/30 transition-colors"
                  >
                    🔎 Proactive Scan
                  </button>
                  <button
                    onClick={() => {
                      setInput("Check system and data quality health");
                    }}
                    className="px-3 py-1.5 text-xs bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 hover:bg-pink-500/30 transition-colors"
                  >
                    ❤️ System Health
                  </button>
                </div>

                <div className="space-y-1 text-[10px] text-white/40">
                  <p>💡 Search: "john@ptd.com" or "+971..."</p>
                  <p>📎 Attach files to analyze</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border border-cyan-500/40 text-white"
                          : "bg-white/5 border border-white/10 text-white/90",
                      )}
                    >
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.files.map((f, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 bg-cyan-500/20 px-2 py-0.5 rounded text-xs text-cyan-300"
                            >
                              {getFileIcon(f.type)}
                              {f.name.slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      )}
                      {msg.isStreaming && !msg.content ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                          <span className="text-white/60">
                            Thinking
                            {loadingSeconds > 0
                              ? ` (${loadingSeconds}s)`
                              : "..."}
                          </span>
                          {loadingSeconds > 5 && (
                            <span className="text-cyan-400/60 text-xs">
                              Analyzing data...
                            </span>
                          )}
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                          {msg.content}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className="px-4 py-2 border-t border-cyan-500/20 bg-slate-800/50">
              <div className="flex flex-wrap gap-1">
                {uploadedFiles.map((file, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-lg text-xs cursor-pointer hover:bg-cyan-500/30 transition-colors"
                    onClick={() => removeFile(i)}
                    title="Click to remove"
                  >
                    {getFileIcon(file.type)}
                    {(file.name || "File").slice(0, 15)}
                    {(file.name || "").length > 15 && "..."}
                    <X className="h-3 w-3 hover:text-white" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-cyan-500/20 bg-gradient-to-r from-slate-800/80 to-slate-900/80 rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.json,.txt,.md"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach files"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  uploadedFiles.length > 0
                    ? "Ask about files..."
                    : "Ask anything..."
                }
                disabled={isLoading}
                className="flex-1 bg-white/10 border-cyan-500/30 text-white placeholder-white/40 focus:ring-cyan-500/50 focus:border-cyan-500"
              />
              <Button
                onClick={handleSend}
                disabled={
                  (!input.trim() && uploadedFiles.length === 0) || isLoading
                }
                className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 border-0"
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

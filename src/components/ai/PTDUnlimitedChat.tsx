import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Send, Brain, Upload, FileText, X, RotateCcw, Database,
  Shield, AlertTriangle, CheckCircle, XCircle, Activity, Zap, Users,
  Minimize2, Maximize2, Mic, MicOff, Volume2, VolumeX
} from "lucide-react";
import { useVoiceChat, useTextToSpeech } from "@/hooks/useVoiceChat";
import { learnFromInteraction } from "@/lib/ptd-knowledge-base";
import { getThreadId, startNewThread, loadConversationHistory, saveMessageToDatabase } from "@/lib/ptd-memory";
import {
  getAgentStats,
  getPendingApprovals,
  approveExecution,
  rejectExecution,
  runMonitoringScan,
  SPECIALIST_AGENTS,
  type ExecutionRequest
} from "@/lib/ptd-unlimited-agent";
import { toast } from "sonner";
import { getApiUrl, API_ENDPOINTS } from "@/config/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentStats {
  memories: number;
  patterns: number;
  executions: number;
  pending_approvals: number;
  specialists: number;
  last_monitoring: string | null;
}

export default function PTDUnlimitedChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [threadId, setThreadId] = useState<string>('');
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ExecutionRequest[]>([]);
  const [showApprovals, setShowApprovals] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice chat hooks
  const {
    isListening,
    isSupported: voiceInputSupported,
    transcript,
    toggleListening,
    clearTranscript,
  } = useVoiceChat({
    onTranscript: (text) => {
      setInput(text);
      clearTranscript();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const {
    isSpeaking,
    isSupported: voiceOutputSupported,
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech();

  useEffect(() => {
    const tid = getThreadId();
    setThreadId(tid);
    loadStats();
    loadPendingApprovals();
    loadChatHistory(tid);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Connection lost - messages will be saved when reconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadChatHistory = async (tid: string) => {
    try {
      setLoadingHistory(true);
      const history = await loadConversationHistory(tid);

      if (history && history.length > 0) {
        // Convert history to messages format and extract uploaded files
        const loadedMessages: { role: string; content: string }[] = [];
        const loadedFiles: { name: string; content: string }[] = [];

        // Load full data to check for document uploads
        const { data } = await supabase
          .from('agent_memory')
          .select('query, response, knowledge_extracted')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true });

        if (data) {
          data.forEach(item => {
            // Skip thread metadata entries
            if (item.query === '[THREAD_START]') return;

            // Check if this is a document upload entry
            const knowledge = item.knowledge_extracted as any;
            if (knowledge?.type === 'document_upload') {
              loadedFiles.push({
                name: knowledge.filename,
                content: knowledge.preview || ''
              });
            }

            loadedMessages.push({ role: 'user', content: item.query });
            loadedMessages.push({ role: 'ai', content: item.response });
          });
        }

        setMessages(loadedMessages);
        if (loadedFiles.length > 0) {
          setUploadedFiles(loadedFiles);
        }

        toast.success(`Loaded ${loadedMessages.length / 2} previous messages`);
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
      toast.error('Could not load previous conversation');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadStats = async () => {
    try {
      const agentStats = await getAgentStats();
      setStats(agentStats);
    } catch (e) {
      console.error('Stats load error:', e);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const approvals = await getPendingApprovals();
      setPendingApprovals(approvals);
    } catch (e) {
      console.error('Approvals load error:', e);
    }
  };

  const handleNewThread = () => {
    const newId = startNewThread();
    setThreadId(newId);
    setMessages([]);
    setUploadedFiles([]);
    toast.success('Started new conversation thread');

    // Load history for new thread (should be empty)
    loadChatHistory(newId);
  };

  const handleRunMonitoring = async () => {
    setMonitoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('ptd-24x7-monitor', { body: {} });

      if (error) {
        toast.error(`Monitoring failed: ${error.message}`);
      } else {
        const alertCount = data?.alert_count || 0;
        const criticalCount = data?.critical_count || 0;

        toast.success(`Monitoring complete: ${alertCount} alerts (${criticalCount} critical)`);

        // Add monitoring results to chat
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `🔍 **24/7 Monitoring Scan Complete**\n\n` +
            `📊 **Metrics:**\n` +
            `- Total Clients: ${data?.metrics?.total_clients || 0}\n` +
            `- At Risk: ${data?.metrics?.at_risk_count || 0}\n` +
            `- Avg Health: ${data?.metrics?.avg_health_score || 0}\n\n` +
            `⚠️ **Alerts (${alertCount}):**\n` +
            (data?.alerts || []).map((a: any) => `• [${a.severity.toUpperCase()}] ${a.message}`).join('\n')
        }]);

        loadStats();
      }
    } catch (e) {
      toast.error('Monitoring scan failed');
    } finally {
      setMonitoring(false);
    }
  };

  const handleApprove = async (requestKey: string) => {
    try {
      await approveExecution(requestKey);
      toast.success('Action approved and executed');
      loadPendingApprovals();
      loadStats();
    } catch (e) {
      toast.error('Approval failed');
    }
  };

  const handleReject = async (requestKey: string) => {
    try {
      await rejectExecution(requestKey, 'Manually rejected by user');
      toast.info('Action rejected');
      loadPendingApprovals();
    } catch (e) {
      toast.error('Rejection failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const content = await file.text();

        const { data, error } = await supabase.functions.invoke("process-knowledge", {
          body: {
            content,
            filename: file.name,
            metadata: { type: file.type, size: file.size }
          },
        });

        if (error) {
          toast.error(`Failed to process ${file.name}`);
        } else {
          // Save full content (no size limit)
          setUploadedFiles(prev => [...prev, { name: file.name, content }]);

          const responseMsg = `📚 Learned from **${file.name}**\n\n${data.chunks_created} knowledge chunks created.`;
          const userQuery = `[Document Upload] ${file.name}`;

          setMessages(prev => [...prev,
          { role: "user", content: userQuery },
          { role: "ai", content: responseMsg }
          ]);

          // Save to agent_memory for persistence across sessions using new utility
          if (isOnline) {
            try {
              await saveMessageToDatabase(threadId, userQuery, responseMsg, {
                type: 'document_upload',
                filename: file.name,
                file_type: file.type,
                file_size: file.size,
                chunks_created: data.chunks_created,
                preview: content.slice(0, 1000) // Store preview for display
              });
            } catch (dbError) {
              console.error('Failed to save file upload to database:', dbError);
              toast.error('File processed but not saved to database');
            }
          }

          toast.success(`Agent learned from ${file.name}`);
        }
      } catch (error) {
        toast.error(`Error reading ${file.name}`);
      }
    }

    setUploading(false);
    loadStats();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAsk = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    const userMsg = { role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInput("");

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.agent), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-ptd-key": import.meta.env.VITE_PTD_INTERNAL_ACCESS_KEY || ""
        },
        body: JSON.stringify({
          message: userMessage,
          thread_id: threadId
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.error) {
        const errorMsg = `Error: ${data?.error || data?.message || 'Agent error'}`;
        setMessages(prev => [...prev, { role: "ai", content: errorMsg }]);

        // Still try to save the error to database if online
        if (isOnline) {
          try {
            await saveMessageToDatabase(threadId, userMessage, errorMsg);
          } catch (dbError) {
            console.error('Failed to save error message to database:', dbError);
          }
        }
      } else if (data?.response) {
        const aiResponse = data.response;
        setMessages(prev => [...prev, { role: "ai", content: aiResponse }]);

        // Speak the AI response if voice is enabled
        if (voiceEnabled && voiceOutputSupported) {
          // Extract text from markdown if present
          const textToSpeak = aiResponse.replace(/[#*`_]/g, '').substring(0, 500);
          speak(textToSpeak);
        }

        // Save conversation to database in real-time with retry
        if (isOnline) {
          try {
            await saveMessageToDatabase(threadId, userMessage, aiResponse);
          } catch (dbError) {
            console.error('Failed to save message to database:', dbError);
            toast.error('Could not save conversation to database', {
              description: 'Your message was sent but not saved. Check your connection.'
            });
          }
        } else {
          toast.warning('Message not saved - you are offline');
        }

        // Learn from interaction (for pattern detection)
        await learnFromInteraction(userMessage, aiResponse);
        loadStats();
        loadPendingApprovals();
      } else if (data?.error) {
        const errorMsg = `Error: ${data.error}`;
        setMessages(prev => [...prev, { role: "ai", content: errorMsg }]);

        if (isOnline) {
          try {
            await saveMessageToDatabase(threadId, userMessage, errorMsg);
          } catch (dbError) {
            console.error('Failed to save error to database:', dbError);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Error: ${error}`;
      setMessages(prev => [...prev, { role: "ai", content: errorMsg }]);

      if (isOnline) {
        try {
          await saveMessageToDatabase(threadId, userMessage, errorMsg);
        } catch (dbError) {
          console.error('Failed to save exception to database:', dbError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-cyan-500/30 rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-105 transition-transform"
        title="Open PTD Chat"
      >
        <Brain className="w-6 h-6 text-cyan-400" />
        <Zap className="w-3 h-3 text-yellow-400 absolute top-2 right-2 animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[550px] h-[750px] bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col z-50">
      {/* Enhanced Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-7 h-7 text-cyan-400" />
              <Zap className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                PTD UNLIMITED
                <Badge variant="outline" className="text-[10px] border-cyan-500/50 text-cyan-400">
                  v2.0
                </Badge>
              </h2>
              <div className="flex items-center gap-3 text-xs text-cyan-400">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {stats?.memories || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {stats?.patterns || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {stats?.specialists || 0}
                </span>
                {!isOnline && (
                  <span className="text-orange-400 text-[10px]">OFFLINE</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Monitoring Button */}
            <button
              onClick={handleRunMonitoring}
              disabled={monitoring}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all group"
              title="Run 24/7 Monitoring"
            >
              {monitoring ? (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              ) : (
                <Activity className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
              )}
            </button>

            {/* Approvals Button */}
            <button
              onClick={() => setShowApprovals(!showApprovals)}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all group relative"
              title="Pending Approvals"
            >
              <Shield className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </button>

            <button
              onClick={handleNewThread}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all group"
              title="Start new thread"
            >
              <RotateCcw className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
            </button>

            <label className="cursor-pointer p-2 hover:bg-cyan-500/20 rounded-lg transition-all group">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
              )}
            </label>

            <button
              onClick={() => setMinimized(true)}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all group"
              title="Minimize chat"
            >
              <Minimize2 className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
            </button>
          </div>
        </div>

        {/* Thread ID & Files */}
        {threadId && (
          <div className="mt-2 text-xs text-white/30 truncate">
            Thread: {threadId.slice(0, 20)}...
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {uploadedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-1 bg-cyan-500/20 text-cyan-300 text-xs px-2 py-1 rounded-full">
                <FileText className="w-3 h-3" />
                <span>{file.name}</span>
                <button onClick={() => removeFile(i)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Approvals Panel */}
      {showApprovals && pendingApprovals.length > 0 && (
        <div className="border-b border-cyan-500/20 bg-slate-800/50 p-3">
          <div className="text-xs text-cyan-400 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Pending Approvals ({pendingApprovals.length})
          </div>
          <ScrollArea className="max-h-32">
            {pendingApprovals.map((req: any, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 mb-1">
                <div>
                  <span className="text-white text-xs">{req.action}</span>
                  <Badge
                    variant="outline"
                    className={`ml-2 text-[9px] ${req.risk_level === 'critical' ? 'border-red-500 text-red-400' :
                      req.risk_level === 'high' ? 'border-orange-500 text-orange-400' :
                        'border-yellow-500 text-yellow-400'
                      }`}
                  >
                    {req.risk_level}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApprove(req.request_key)}
                    className="p-1 hover:bg-green-500/20 rounded"
                  >
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </button>
                  <button
                    onClick={() => handleReject(req.request_key)}
                    className="p-1 hover:bg-red-500/20 rounded"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20">
        {loadingHistory && (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-cyan-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading conversation history...</span>
            </div>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-3">
              <div className="relative">
                <Brain className="w-12 h-12 text-cyan-400 mx-auto opacity-50" />
                <Zap className="w-4 h-4 text-yellow-400 absolute top-0 right-1/3 animate-pulse" />
              </div>
              <p className="text-white/70 font-medium">UNLIMITED POWER Agent</p>
              <div className="text-xs text-white/50 space-y-1">
                <p>⚡ 10 Specialist Agents</p>
                <p>🔍 24/7 Monitoring</p>
                <p>🛡️ Human-in-the-loop Approvals</p>
                <p>🧠 Self-learning from every interaction</p>
                <p className="mt-2 text-cyan-400/70">Ask anything...</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-4 ${msg.role === "user"
              ? "bg-cyan-500/20 border border-cyan-500/40 text-white"
              : "bg-white/5 border border-white/10 text-white/90"
              }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-sm text-white/70">Processing with unlimited power...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-cyan-500/20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-b-2xl">
        {/* Voice transcript indicator */}
        {isListening && (
          <div className="mb-2 flex items-center gap-2 text-xs text-cyan-400 animate-pulse">
            <Mic className="w-4 h-4" />
            <span>Listening... {transcript && `"${transcript}"`}</span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && handleAsk()}
            placeholder="Unlimited commands... execute actions... monitor 24/7"
            className="flex-1 bg-white/10 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            disabled={loading}
          />

          {/* Voice input button */}
          {voiceInputSupported && (
            <button
              onClick={toggleListening}
              disabled={loading}
              className={`p-3 rounded-lg transition-all ${isListening
                ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                }`}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Voice output toggle */}
          {voiceOutputSupported && (
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (!voiceEnabled && isSpeaking) {
                  stopSpeaking();
                }
              }}
              className={`p-3 rounded-lg transition-all ${voiceEnabled
                ? 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30'
                : 'bg-white/10 border border-cyan-500/30 text-white/40 hover:bg-white/20'
                }`}
              title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
            >
              {voiceEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>
          )}

          <button
            onClick={handleAsk}
            disabled={loading || !input.trim()}
            className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 rounded-lg text-white transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

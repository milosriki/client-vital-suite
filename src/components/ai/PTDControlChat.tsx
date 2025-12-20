import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Brain, Upload, FileText, X, RotateCcw, Database, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { learnFromInteraction } from "@/lib/ptd-knowledge-base";
import { getThreadId, startNewThread, loadConversationHistory, saveMessageToDatabase } from "@/lib/ptd-memory";
import { toast } from "sonner";
import { useVoiceChat, useTextToSpeech } from "@/hooks/useVoiceChat";

export default function PTDControlChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [threadId, setThreadId] = useState<string>('');
  const [memoryStats, setMemoryStats] = useState<{ memories: number; patterns: number } | null>(null);
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

  // Initialize thread ID and load conversation history
  useEffect(() => {
    const tid = getThreadId();
    setThreadId(tid);
    loadMemoryStats();
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
        // Convert history to messages format
        const loadedMessages = history.map(item => ({
          role: item.role,
          content: item.content
        }));

        setMessages(loadedMessages);
        toast.success(`Loaded ${history.length / 2} previous messages`);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      toast.error('Could not load previous conversation');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadMemoryStats = async () => {
    try {
      const [memRes, patRes] = await Promise.all([
        supabase.from('agent_memory').select('id', { count: 'exact', head: true }),
        supabase.from('agent_patterns').select('id', { count: 'exact', head: true })
      ]);
      setMemoryStats({
        memories: memRes.count || 0,
        patterns: patRes.count || 0
      });
    } catch (e) {
      // Stats not critical
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
            metadata: { 
              type: file.type,
              size: file.size,
              uploadedAt: new Date().toISOString()
            }
          },
        });

        if (error) {
          toast.error(`Failed to process ${file.name}: ${error.message}`);
        } else {
          setUploadedFiles(prev => [...prev, { name: file.name, content: content.slice(0, 500) }]);
          toast.success(`✅ Agent learned from ${file.name}!`);

          const userQuery = `[Document Upload] ${file.name}`;
          const aiResponse = `📚 Learned from **${file.name}**\n\n${data.chunks_created} knowledge chunks created. I can now answer questions based on this content!`;

          setMessages(prev => [...prev, {
            role: "ai",
            content: aiResponse
          }]);

          // Save file upload to database
          if (isOnline) {
            try {
              await saveMessageToDatabase(threadId, userQuery, aiResponse, {
                type: 'document_upload',
                filename: file.name,
                file_type: file.type,
                file_size: file.size,
                chunks_created: data.chunks_created,
                preview: content.slice(0, 1000)
              });
            } catch (dbError) {
              console.error('Failed to save file upload to database:', dbError);
            }
          }
        }
      } catch (error) {
        toast.error(`Error reading ${file.name}`);
      }
    }

    setUploading(false);
    loadMemoryStats();
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
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          thread_id: threadId  // Pass thread ID for memory continuity
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
        loadMemoryStats(); // Refresh stats after interaction
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

  return (
    <div className="fixed bottom-6 right-6 w-[500px] h-[700px] bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="font-bold text-lg text-white">PTD CONTROL</h2>
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <span>Persistent Memory Agent</span>
                {memoryStats && (
                  <span className="flex items-center gap-1 text-white/50">
                    <Database className="w-3 h-3" />
                    {memoryStats.memories} memories
                  </span>
                )}
                {!isOnline && (
                  <span className="text-orange-400 text-[10px]">OFFLINE</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* New Thread Button */}
            <button
              onClick={handleNewThread}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all group"
              title="Start new thread"
            >
              <RotateCcw className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
            </button>
            
            {/* Upload Button */}
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
          </div>
        </div>
        
        {/* Thread ID indicator */}
        {threadId && (
          <div className="mt-2 text-xs text-white/30 truncate">
            Thread: {threadId.slice(0, 20)}...
          </div>
        )}
        
        {/* Uploaded Files Pills */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
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
              <Brain className="w-12 h-12 text-cyan-400 mx-auto opacity-50" />
              <p className="text-white/70">I remember everything...</p>
              <div className="text-xs text-white/50 space-y-1">
                <p>💡 "Show john@ptd.com full journey"</p>
                <p>💡 "Scan for Stripe fraud"</p>
                <p>📁 Upload files to teach me formulas!</p>
                <p>🧠 I learn from every conversation</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-4 ${
              msg.role === "user"
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
                <span className="text-sm text-white/70">Thinking with memory...</span>
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
            placeholder="Ask anything - I remember our history..."
            className="flex-1 bg-white/10 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            disabled={loading}
          />
          
          {/* Voice input button */}
          {voiceInputSupported && (
            <button
              onClick={toggleListening}
              disabled={loading}
              className={`p-3 rounded-lg transition-all ${
                isListening
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
              className={`p-3 rounded-lg transition-all ${
                voiceEnabled
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

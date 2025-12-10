import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Brain, Upload, FileText, X } from "lucide-react";
import { learnFromInteraction } from "@/lib/ptd-knowledge-base";
import { toast } from "sonner";

export default function PTDControlChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Read file content
        const content = await file.text();
        
        // Process through RAG system
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
          setMessages(prev => [...prev, { 
            role: "ai", 
            content: `📚 Learned from **${file.name}**\n\n${data.chunks_created} knowledge chunks created. I can now answer questions based on this content!` 
          }]);
        }
      } catch (error) {
        toast.error(`Error reading ${file.name}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAsk = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("ptd-agent-claude", {
        body: { message: input },
      });

      if (error) {
        setMessages(prev => [...prev, { role: "ai", content: `Error: ${error.message}` }]);
      } else if (data?.response) {
        setMessages(prev => [...prev, { role: "ai", content: data.response }]);
        await learnFromInteraction(input, data.response);
      } else if (data?.error) {
        setMessages(prev => [...prev, { role: "ai", content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", content: `Error: ${error}` }]);
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
              <p className="text-xs text-cyan-400">RAG-enabled learning agent</p>
            </div>
          </div>
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
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-3">
              <Brain className="w-12 h-12 text-cyan-400 mx-auto opacity-50" />
              <p className="text-white/70">Ask about your PTD system...</p>
              <div className="text-xs text-white/50 space-y-1">
                <p>💡 "Show john@ptd.com full journey"</p>
                <p>💡 "Scan for Stripe fraud"</p>
                <p>📁 Upload files to teach me formulas!</p>
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
                <span className="text-sm text-white/70">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-cyan-500/20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-b-2xl">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && handleAsk()}
            placeholder="Ask about clients, leads, calls, Stripe, HubSpot..."
            className="flex-1 bg-white/10 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            disabled={loading}
          />
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

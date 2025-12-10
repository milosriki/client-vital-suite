import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Minimize2, Paperclip, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: { name: string; type: string }[];
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

export const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const maxSize = 10 * 1024 * 1024; // 10MB
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
      
      if (fileType.includes("pdf") || fileType.includes("excel") || fileType.includes("spreadsheet") || 
          fileType.includes("csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        reader.onload = () => {
          const base64 = btoa(
            new Uint8Array(reader.result as ArrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
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
    if (type.includes("excel") || type.includes("spreadsheet") || type.includes("csv")) 
      return <FileSpreadsheet className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage = input.trim();
    const files = [...uploadedFiles];
    
    setInput("");
    setUploadedFiles([]);
    
    const displayMessage = userMessage || `Analyzing ${files.length} file(s)...`;
    setMessages((prev) => [...prev, { 
      role: "user", 
      content: displayMessage,
      files: files.map(f => ({ name: f.name, type: f.type }))
    }]);
    setIsLoading(true);

    try {
      const fileContents = files.map((f) => ({
        name: f.name,
        type: f.type,
        content: f.content,
      }));

      const messageWithFiles = files.length > 0
        ? `${userMessage}\n\n[UPLOADED FILES]\n${files.map(f => `- ${f.name}`).join("\n")}\n\n[FILE CONTENTS]\n${fileContents.map(f => `=== ${f.name} ===\n${f.content.slice(0, 50000)}`).join("\n\n")}`
        : userMessage;

      const { data, error } = await supabase.functions.invoke("ptd-agent-gemini", {
        body: { 
          message: messageWithFiles,
          thread_id: localStorage.getItem("chat-thread") || `chat-${Date.now()}`,
          has_files: files.length > 0,
          file_names: files.map(f => f.name),
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data?.response || "No response received" },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col bg-background border border-border rounded-lg shadow-2xl transition-all duration-200",
        isMinimized ? "w-72 h-12" : "w-96 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">PTD Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
              <div className="text-center text-muted-foreground text-sm py-8">
                <p>Ask me anything about your data!</p>
                <p className="mt-2 text-xs">Upload PDFs, Excel, CSV to analyze</p>
                <p className="mt-1 text-xs text-primary">📎 Click + to attach files</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.files.map((f, j) => (
                            <span key={j} className="inline-flex items-center gap-1 bg-background/20 px-2 py-0.5 rounded text-xs">
                              {getFileIcon(f.type)}
                              {f.name.slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      )}
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <div className="flex flex-wrap gap-1">
                {uploadedFiles.map((file, i) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs cursor-pointer hover:bg-primary/20"
                    onClick={() => removeFile(i)}
                    title="Click to remove"
                  >
                    {getFileIcon(file.type)}
                    {file.name.slice(0, 15)}...
                    <X className="h-3 w-3" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border">
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
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach files (PDF, Excel, CSV)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploadedFiles.length > 0 ? "Ask about files..." : "Ask anything..."}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

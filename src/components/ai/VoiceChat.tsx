import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getThreadId } from "@/lib/ptd-memory";
import { cn } from "@/lib/utils";

interface VoiceChatProps {
  agentFunction?: string;
  threadId?: string;
  onClose?: () => void;
  minimized?: boolean;
  onMinimize?: () => void;
}

export function VoiceChat({ 
  agentFunction = "ptd-agent-gemini",
  threadId: providedThreadId,
  onClose,
  minimized = false,
  onMinimize
}: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const threadIdRef = useRef<string>(providedThreadId || getThreadId());

  useEffect(() => {
    // Check browser support
    const checkSupport = () => {
      const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      const hasSynthesis = 'speechSynthesis' in window;
      setIsSupported(hasRecognition && hasSynthesis);
      
      if (!hasRecognition) {
        setError("Speech recognition not supported in this browser. Use Chrome or Edge.");
      }
      if (!hasSynthesis) {
        setError("Speech synthesis not supported in this browser.");
      }
    };

    checkSupport();

    // Initialize speech recognition
    if (isSupported) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setTranscript(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'no-speech') {
            setError('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            setError('Microphone permission denied. Please enable microphone access.');
          } else {
            setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    // Initialize speech synthesis
    synthesisRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, [isSupported]);

  const startListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not initialized");
      return;
    }

    try {
      setTranscript("");
      setError(null);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      setError("Failed to start listening");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          thread_id: threadIdRef.current
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.error) {
        throw new Error(data?.error || data?.message || "Failed to get response");
      }

      const response = data?.response || "I didn't receive a response. Please try again.";
      setLastResponse(response);
      
      // Speak the response
      speakText(response);
      
      toast({
        title: "Response received",
        description: "AI response is being spoken",
      });
    } catch (err: any) {
      console.error('Voice chat error:', err);
      setError(err.message || "Failed to get response");
      toast({
        title: "Error",
        description: err.message || "Failed to get response",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text: string) => {
    if (!synthesisRef.current) {
      setError("Speech synthesis not available");
      return;
    }

    // Cancel any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setError("Failed to speak response");
    };

    synthesisRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleTranscriptSubmit = () => {
    if (transcript.trim()) {
      sendMessage(transcript);
      setTranscript("");
    }
  };

  // Auto-submit when recognition ends with transcript
  useEffect(() => {
    if (!isListening && transcript.trim() && !isProcessing) {
      // Small delay to ensure recognition is fully stopped
      const timer = setTimeout(() => {
        if (transcript.trim()) {
          sendMessage(transcript);
          setTranscript("");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript, isProcessing]);

  if (minimized) {
    return (
      <Button
        onClick={onMinimize}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-purple-900 via-purple-800 to-black border border-purple-500/30 rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-105 transition-transform"
        title="Open Voice Chat"
      >
        <Mic className={cn(
          "w-6 h-6 transition-colors",
          isListening ? "text-red-400 animate-pulse" : "text-purple-400"
        )} />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[400px] bg-gradient-to-br from-purple-900/95 via-purple-800/95 to-black/95 border border-purple-500/30 shadow-2xl backdrop-blur-xl z-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-400" />
            Voice Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            {onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onMinimize}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-sm text-yellow-200">
            ⚠️ Voice chat requires Chrome or Edge browser with microphone access.
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          {isListening && (
            <Badge variant="destructive" className="animate-pulse">
              <Mic className="w-3 h-3 mr-1" />
              Listening...
            </Badge>
          )}
          {isSpeaking && (
            <Badge variant="default" className="bg-purple-600 animate-pulse">
              <Volume2 className="w-3 h-3 mr-1" />
              Speaking...
            </Badge>
          )}
          {isProcessing && (
            <Badge variant="secondary">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing...
            </Badge>
          )}
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">You said:</div>
            <div className="text-sm text-white">{transcript}</div>
          </div>
        )}

        {/* Last Response Display */}
        {lastResponse && (
          <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/50">
            <div className="text-xs text-purple-300 mb-1">AI Response:</div>
            <div className="text-sm text-white">{lastResponse}</div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported || isProcessing}
            className={cn(
              "flex-1",
              isListening && "bg-red-600 hover:bg-red-700"
            )}
            size="lg"
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Listening
              </>
            )}
          </Button>

          {isSpeaking && (
            <Button
              onClick={stopSpeaking}
              variant="outline"
              size="lg"
            >
              <VolumeX className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}

          {transcript && !isListening && (
            <Button
              onClick={handleTranscriptSubmit}
              disabled={isProcessing}
              variant="outline"
              size="lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-slate-400 space-y-1">
          <div>💡 Click "Start Listening" and speak your question</div>
          <div>🎤 The AI will respond with voice</div>
          <div>🔊 Adjust volume in your system settings</div>
        </div>
      </CardContent>
    </Card>
  );
}

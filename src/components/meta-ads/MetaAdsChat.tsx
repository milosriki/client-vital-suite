import { useState, useRef, useEffect } from 'react';
import { useMetaAds, type ChatMessage } from '@/hooks/useMetaAds';
import type { TaskType } from '@/types/metaAds';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send, Square, Trash2, BarChart3, AlertTriangle, DollarSign,
  Users, Palette, FileText, MessageSquare, Sparkles,
} from 'lucide-react';

const QUICK_PROMPTS: Array<{ label: string; prompt: string; taskType: TaskType; icon: typeof BarChart3 }> = [
  {
    label: 'Campaign Overview',
    prompt: 'Show me all active campaigns with spend, CPA, and ROAS for the last 7 days. Highlight any with CPA > 500 AED.',
    taskType: 'data_fetch',
    icon: BarChart3,
  },
  {
    label: 'Performance Alerts',
    prompt: 'Analyze last 7 days. Which campaigns need immediate attention? Flag high CPA, low ROAS, declining performance.',
    taskType: 'performance_alerts',
    icon: AlertTriangle,
  },
  {
    label: 'Budget Optimization',
    prompt: 'Based on last 30 days performance, recommend budget reallocation across campaigns to maximize conversions.',
    taskType: 'budget_optimization',
    icon: DollarSign,
  },
  {
    label: 'Audience Analysis',
    prompt: 'Break down last 30 days by age, gender, and placement. Which segments have the best CPA for our 40+ executive demographic?',
    taskType: 'audience_insights',
    icon: Users,
  },
  {
    label: 'Top Creatives',
    prompt: 'Show me the top 10 performing ads by conversions in the last 14 days with their CPA and ROAS.',
    taskType: 'creative_analysis',
    icon: Palette,
  },
  {
    label: 'Weekly Report',
    prompt: 'Generate a comprehensive weekly report: total spend, conversions, avg CPA, avg ROAS, best/worst campaigns, and 3 optimization recommendations.',
    taskType: 'chat',
    icon: FileText,
  },
];

export default function MetaAdsChat() {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearChat,
    tokenStats,
  } = useMetaAds({ dailyBudget: 10 });

  const [input, setInput] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskType>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim(), selectedTask);
    setInput('');
    setSelectedTask('chat');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const budgetPercent = tokenStats.dailyBudget > 0
    ? Math.min(100, (tokenStats.todayCost / tokenStats.dailyBudget) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 rounded-xl overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="font-semibold text-sm tracking-wide">Meta Ads AI</span>
          <Badge variant="outline" className="text-[10px]">Qwen + MCP</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${budgetPercent}%`,
                  backgroundColor: budgetPercent > 80 ? '#ef4444' : budgetPercent > 50 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            <span className="text-zinc-500">${tokenStats.todayCost.toFixed(3)} / ${tokenStats.dailyBudget}</span>
          </div>
          <span className="text-xs text-zinc-600">{tokenStats.todayQueries} queries</span>
          <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 px-2 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center space-y-2">
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto" />
              <h3 className="text-lg font-medium text-zinc-300">PTD Meta Ads Intelligence</h3>
              <p className="text-sm text-zinc-500 max-w-md">
                Analyze campaigns, optimize budgets, and manage ads through conversation.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-2xl">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt, qp.taskType)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all text-left group cursor-pointer"
                >
                  <qp.icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
                  <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-zinc-900/40 p-3 shrink-0">
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
          {([
            { key: 'chat' as TaskType, label: 'Chat', icon: MessageSquare },
            { key: 'data_fetch' as TaskType, label: 'Fetch Data', icon: BarChart3 },
            { key: 'performance_alerts' as TaskType, label: 'Alerts', icon: AlertTriangle },
            { key: 'budget_optimization' as TaskType, label: 'Budget', icon: DollarSign },
            { key: 'audience_insights' as TaskType, label: 'Audience', icon: Users },
            { key: 'creative_analysis' as TaskType, label: 'Creatives', icon: Palette },
          ]).map((task) => (
            <button
              key={task.key}
              onClick={() => setSelectedTask(task.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all cursor-pointer ${
                selectedTask === task.key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <task.icon className="w-3 h-3" />
              {task.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your campaigns..."
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
          {isStreaming ? (
            <Button variant="destructive" size="sm" onClick={stopStreaming} className="px-4 py-2.5 cursor-pointer">
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || tokenStats.isOverBudget}
              className="px-4 py-2.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.toolCalls.map((tc, i) => (
              <Badge key={i} variant="outline" className="text-[10px] text-violet-400 border-violet-500/20 bg-violet-500/10">
                {tc.name}
              </Badge>
            ))}
          </div>
        )}

        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-zinc-800/80 text-zinc-200 rounded-bl-sm border border-zinc-700/50'
          }`}
        >
          {message.isStreaming && !message.content && (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
          <MessageContent content={message.content} />
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>

        {!isUser && !message.isStreaming && message.cost !== undefined && (
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span>{message.model}</span>
            <span>${message.cost.toFixed(4)}</span>
            {message.usage && (
              <span>{(message.usage.input_tokens + message.usage.output_tokens).toLocaleString()} tokens</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object') {
      return (
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap bg-zinc-900/50 rounded-lg p-2 mt-1">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    }
  } catch {
    // Not JSON
  }

  const parts = content.split(/(```(?:json)?[\s\S]*?```)/g);
  if (parts.length > 1) {
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const code = part.replace(/```(?:json)?\n?/, '').replace(/\n?```$/, '');
            return (
              <pre key={i} className="text-xs font-mono overflow-x-auto whitespace-pre-wrap bg-zinc-900/50 rounded-lg p-2 my-1.5">
                {code}
              </pre>
            );
          }
          return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        })}
      </>
    );
  }

  return <span className="whitespace-pre-wrap">{content}</span>;
}

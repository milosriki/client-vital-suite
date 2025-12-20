'use client';

import { useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
  evidence?: any;
  sourcesUsed?: string[];
}

interface Thread {
  id: string;
  thread_name: string;
  last_message_at: string;
}

interface ThreadsResponse {
  ok: boolean;
  data: Thread[];
}

interface ThreadDetailResponse {
  ok: boolean;
  data: Thread & { messages: Message[] };
}

interface QueryResponse {
  ok: boolean;
  data: {
    answer: string;
    evidence?: { rowCount: number; tables: string[] };
    sourcesUsed?: string[];
  };
  error?: { error: string };
}

export default function GlobalBrainPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load threads on mount
  useEffect(() => {
    loadThreads();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadThreads() {
    try {
      const res = await fetch('/api/threads');
      const data: ThreadsResponse = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setThreads(data.data);
      }
    } catch (e) {
      console.error('Failed to load threads', e);
    }
  }

  async function createThread() {
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Chat ${new Date().toLocaleString()}` }),
      });
      const data: ThreadDetailResponse = await res.json();
      if (data.ok && data.data?.id) {
        setCurrentThread(data.data.id);
        setMessages([]);
        loadThreads();
      }
    } catch (e) {
      console.error('Failed to create thread', e);
    }
  }

  async function loadThread(threadId: string) {
    try {
      const res = await fetch(`/api/threads?id=${threadId}`);
      const data: ThreadDetailResponse = await res.json();
      if (data.ok) {
        setCurrentThread(threadId);
        setMessages(data.data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load thread', e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMessage = question.trim();
    setQuestion('');
    setErrorMessage(null);
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          mode,
          threadId: currentThread,
          includeEvidence: true,
        }),
      });

      const data: QueryResponse = await res.json();

      if (!data.ok) {
        throw new Error(data.error?.error || 'Query failed');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.data.answer,
          evidence: data.data.evidence,
          sourcesUsed: data.data.sourcesUsed,
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const latestEvidence = messages.filter((m) => m.role === 'assistant' && m.sourcesUsed).slice(-1)[0];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🧠</div>
            <div>
              <h1 className="text-2xl font-bold">PTD Global Brain</h1>
              <p className="text-sm text-gray-400">Company-wide memory with evidence tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'fast' | 'deep')}
              className="bg-gray-800 border border-gray-700 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fast">⚡ Fast Mode</option>
              <option value="deep">🔍 Deep Mode (RAG)</option>
            </select>
            <button
              onClick={createThread}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-semibold"
            >
              + New Thread
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar: Threads */}
          <div className="lg:col-span-1 bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Threads</h2>
              <span className="text-xs text-gray-400">{threads.length} active</span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {threads.length === 0 && <p className="text-sm text-gray-500">No threads yet</p>}
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadThread(t.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm border border-gray-700 transition ${
                    currentThread === t.id ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-semibold truncate">{t.thread_name}</div>
                  <div className="text-xs text-gray-400">Last: {new Date(t.last_message_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Main: Chat */}
          <div className="lg:col-span-2 bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex-1 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}-${msg.content.slice(0, 10)}`}
                  className={`${msg.role === 'user' ? 'bg-blue-900/40 border border-blue-700 ml-4' : 'bg-gray-700 border border-gray-600 mr-4'} p-3 rounded-lg`}
                >
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    {msg.role === 'user' ? 'You' : 'Brain'}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                    <div className="mt-3 text-xs text-gray-300">
                      Sources: {msg.sourcesUsed.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="text-sm text-gray-400">Thinking...</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {errorMessage && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 px-4 py-2 rounded text-sm">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-3 items-center">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about PTD..."
                className="flex-1 bg-gray-700 border border-gray-600 px-4 py-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded font-semibold disabled:opacity-70"
                disabled={loading}
              >
                {loading ? '...' : 'Ask'}
              </button>
            </form>
          </div>

          {/* Sidebar: Evidence */}
          <div className="lg:col-span-1 bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">📊 Evidence</h2>
            {latestEvidence ? (
              <div className="text-sm space-y-2">
                <div>
                  <div className="text-gray-400 text-xs uppercase">Tables</div>
                  <ul className="list-disc list-inside text-white/90">
                    {latestEvidence.sourcesUsed?.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                {latestEvidence.evidence && (
                  <div className="text-xs text-gray-300">
                    Rows scanned: {latestEvidence.evidence.rowCount ?? 'n/a'}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Ask a question to see evidence</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

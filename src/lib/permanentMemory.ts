/**
 * PTD PERMANENT MEMORY SYSTEM
 * 
 * For internal PTD team use only.
 * Memory NEVER expires - accessible from ANY device.
 * Maximum intelligence, maximum data retention.
 * 
 * Usage:
 *   import memory from '@/lib/permanentMemory';
 *   
 *   // Set identity once (or auto-detect)
 *   memory.setUser('milos');
 *   
 *   // Store anything - persists FOREVER
 *   await memory.set('last_query', { question: '...', answer: '...' });
 *   
 *   // Retrieve from ANY device
 *   const data = await memory.get('last_query');
 *   
 *   // Store conversation history
 *   await memory.appendConversation({ role: 'user', content: '...' });
 *   const history = await memory.getConversation();
 */

const API_BASE = "https://client-vital-suite.vercel.app";

// Default user for PTD internal use
const DEFAULT_USER = 'ptd_team';
const USER_KEY_STORAGE = 'ptd_memory_user';

let currentUser: string | null = null;

// ============================================
// USER MANAGEMENT
// ============================================

export function setUser(userKey: string): void {
  currentUser = userKey;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(USER_KEY_STORAGE, userKey);
  }
}

export function getUser(): string {
  if (currentUser) return currentUser;
  
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(USER_KEY_STORAGE);
    if (stored) {
      currentUser = stored;
      return stored;
    }
  }
  
  // Default to team user for simplicity
  currentUser = DEFAULT_USER;
  return DEFAULT_USER;
}

// ============================================
// CORE MEMORY OPERATIONS
// ============================================

/**
 * Store a value permanently
 */
export async function set(
  key: string, 
  value: any, 
  type: 'general' | 'preference' | 'context' | 'conversation' | 'knowledge' = 'general'
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/user-memory`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-User-Key': getUser(),
    },
    body: JSON.stringify({ key, value, type }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Store failed' }));
    throw new Error(error.error || 'Failed to store memory');
  }
}

/**
 * Get a single value
 */
export async function get<T = any>(key: string): Promise<T | null> {
  const response = await fetch(
    `${API_BASE}/api/user-memory?key=${encodeURIComponent(key)}`,
    { headers: { 'X-User-Key': getUser() } }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.json().catch(() => ({ error: 'Get failed' }));
    throw new Error(error.error || 'Failed to get memory');
  }

  const data = await response.json();
  return data.value ?? null;
}

/**
 * Get all memory (optionally filtered by type)
 */
export async function getAll(type?: string): Promise<Array<{
  key: string;
  value: any;
  type: string;
  updated_at: string;
}>> {
  let url = `${API_BASE}/api/user-memory`;
  if (type) url += `?type=${encodeURIComponent(type)}`;
  
  const response = await fetch(url, { 
    headers: { 'X-User-Key': getUser() } 
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Get failed' }));
    throw new Error(error.error || 'Failed to get memory');
  }

  const data = await response.json();
  return (data.memory || []).map((m: any) => ({
    key: m.memory_key,
    value: m.memory_value,
    type: m.memory_type,
    updated_at: m.updated_at,
  }));
}

/**
 * Delete a value
 */
export async function remove(key: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/user-memory?key=${encodeURIComponent(key)}`,
    { 
      method: 'DELETE',
      headers: { 'X-User-Key': getUser() } 
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || 'Failed to delete memory');
  }
}

// ============================================
// CONVERSATION HISTORY (for AI context)
// ============================================

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

const CONVERSATION_KEY = '_conversation_history';
const MAX_CONVERSATION_LENGTH = 100; // Keep last 100 messages

/**
 * Get full conversation history
 */
export async function getConversation(): Promise<Message[]> {
  const history = await get<Message[]>(CONVERSATION_KEY);
  return history || [];
}

/**
 * Append a message to conversation
 */
export async function appendConversation(message: Message): Promise<void> {
  const history = await getConversation();
  
  history.push({
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
  });
  
  // Keep only last N messages
  const trimmed = history.slice(-MAX_CONVERSATION_LENGTH);
  
  await set(CONVERSATION_KEY, trimmed, 'conversation');
}

/**
 * Replace entire conversation
 */
export async function setConversation(messages: Message[]): Promise<void> {
  await set(CONVERSATION_KEY, messages.slice(-MAX_CONVERSATION_LENGTH), 'conversation');
}

/**
 * Clear conversation history
 */
export async function clearConversation(): Promise<void> {
  await remove(CONVERSATION_KEY);
}

// ============================================
// KNOWLEDGE BASE (facts about business)
// ============================================

/**
 * Store a fact/knowledge
 */
export async function setKnowledge(factKey: string, factValue: any): Promise<void> {
  await set(`knowledge_${factKey}`, factValue, 'knowledge');
}

/**
 * Get a fact
 */
export async function getKnowledge<T = any>(factKey: string): Promise<T | null> {
  return get<T>(`knowledge_${factKey}`);
}

/**
 * Get all knowledge
 */
export async function getAllKnowledge(): Promise<Record<string, any>> {
  const all = await getAll('knowledge');
  const result: Record<string, any> = {};
  
  for (const item of all) {
    const key = item.key.replace('knowledge_', '');
    result[key] = item.value;
  }
  
  return result;
}

// ============================================
// PREFERENCES
// ============================================

export async function setPreference(key: string, value: any): Promise<void> {
  await set(`pref_${key}`, value, 'preference');
}

export async function getPreference<T = any>(key: string): Promise<T | null> {
  return get<T>(`pref_${key}`);
}

// ============================================
// CONTEXT (temporary but persistent)
// ============================================

export async function setContext(key: string, value: any): Promise<void> {
  await set(`ctx_${key}`, value, 'context');
}

export async function getContext<T = any>(key: string): Promise<T | null> {
  return get<T>(`ctx_${key}`);
}

// ============================================
// DEFAULT EXPORT
// ============================================

const memory = {
  // User
  setUser,
  getUser,
  
  // Core
  set,
  get,
  getAll,
  remove,
  
  // Conversation
  getConversation,
  appendConversation,
  setConversation,
  clearConversation,
  
  // Knowledge
  setKnowledge,
  getKnowledge,
  getAllKnowledge,
  
  // Preferences
  setPreference,
  getPreference,
  
  // Context
  setContext,
  getContext,
};

export default memory;

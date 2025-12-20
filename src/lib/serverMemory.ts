/**
 * Server-Side Memory Helper
 * 
 * All memory operations go through API routes (no direct DB access).
 * This ensures all data persistence happens server-side only.
 */

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

// Session management
export interface Session {
  session_id: string;
  device_fingerprint?: string;
  browser_info?: Record<string, any>;
  created_at: string;
  last_accessed_at: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

// Memory entry
export interface MemoryEntry {
  id: string;
  session_id: string;
  memory_key: string;
  memory_value: any;
  memory_type: "context" | "preference" | "history";
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

/**
 * Create or get a session
 */
export async function createOrGetSession(
  sessionId?: string,
  options?: {
    device_fingerprint?: string;
    browser_info?: Record<string, any>;
    expires_in?: number; // seconds
  }
): Promise<Session> {
  const response = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create session" }));
    throw new Error(error.error || "Failed to create session");
  }

  const data = await response.json();
  return data.session;
}

/**
 * Get session info
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const response = await fetch(`${API_BASE}/api/session?session_id=${sessionId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to get session" }));
    throw new Error(error.error || "Failed to get session");
  }

  const data = await response.json();
  return data.session;
}

/**
 * Store memory (key-value)
 */
export async function storeMemory(
  sessionId: string,
  key: string,
  value: any,
  options?: {
    type?: "context" | "preference" | "history";
    expires_in?: number; // seconds
  }
): Promise<MemoryEntry> {
  const response = await fetch(`${API_BASE}/api/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      key,
      value,
      type: options?.type || "context",
      expires_in: options?.expires_in,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to store memory" }));
    throw new Error(error.error || "Failed to store memory");
  }

  const data = await response.json();
  return data.memory;
}

/**
 * Get memory (all or by key)
 */
export async function getMemory(
  sessionId: string,
  key?: string
): Promise<MemoryEntry[]> {
  const url = new URL(`${API_BASE}/api/memory`);
  url.searchParams.set("session_id", sessionId);
  if (key) {
    url.searchParams.set("key", key);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to get memory" }));
    throw new Error(error.error || "Failed to get memory");
  }

  const data = await response.json();
  return data.memory || [];
}

/**
 * Delete memory (by key or all for session)
 */
export async function deleteMemory(sessionId: string, key?: string): Promise<void> {
  const url = new URL(`${API_BASE}/api/memory`);
  url.searchParams.set("session_id", sessionId);
  if (key) {
    url.searchParams.set("key", key);
  }

  const response = await fetch(url.toString(), {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to delete memory" }));
    throw new Error(error.error || "Failed to delete memory");
  }
}

/**
 * Get or create session ID (with localStorage fallback)
 */
export async function getOrCreateSessionId(): Promise<string> {
  const STORAGE_KEY = "server_session_id";
  
  // Try to get from localStorage
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (sessionId) {
    // Verify session still exists
    try {
      const session = await getSession(sessionId);
      if (session) {
        return sessionId;
      }
    } catch (error) {
      // Session invalid, create new one
      sessionId = null;
    }
  }

  // Create new session
  const session = await createOrGetSession(undefined, {
    expires_in: 30 * 24 * 60 * 60, // 30 days
  });

  sessionId = session.session_id;
  localStorage.setItem(STORAGE_KEY, sessionId);

  return sessionId;
}

/**
 * Helper: Store conversation context
 */
export async function storeConversation(
  sessionId: string,
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  await storeMemory(sessionId, "conversation_history", messages, {
    type: "history",
    expires_in: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Helper: Get conversation context
 */
export async function getConversation(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  const memory = await getMemory(sessionId, "conversation_history");
  if (memory.length > 0) {
    return memory[0].memory_value || [];
  }
  return [];
}


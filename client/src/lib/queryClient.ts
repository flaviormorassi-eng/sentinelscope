import { QueryClient } from "@tanstack/react-query";
import { trigger as triggerMfa } from '@/lib/mfaBus';
import { auth } from "./firebase";

// --- MFA replay store ---
interface FailedRequestRecord {
  method: string;
  url: string;
  options: RequestInit;
  timestamp: number;
}
let mfaFailedQueue: FailedRequestRecord[] = [];

/** Capture the last request that failed due to MFA requirement */
function recordMfaFailedRequest(method: string, url: string, options: RequestInit) {
  mfaFailedQueue.push({ method, url, options, timestamp: Date.now() });
}

/** Replay all queued MFA-failed requests. Returns { successCount, total }. */
export async function replayAllMfaFailedRequests(): Promise<{ successCount: number; total: number }> {
  if (mfaFailedQueue.length === 0) return { successCount: 0, total: 0 };
  const queue = [...mfaFailedQueue];
  mfaFailedQueue = []; // clear early to avoid duplication
  let successCount = 0;
  for (const entry of queue) {
    try {
      await handleRequest(entry.url, { ...entry.options, method: entry.method });
      successCount++;
    } catch (e) {
      // push back for potential future retry if still failing due to MFA
      const err = e as any;
      if (err?.message?.includes('MFA')) {
        mfaFailedQueue.push(entry);
      }
    }
  }
  return { successCount, total: queue.length };
}

async function handleRequest(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  // Get Firebase user for authentication (used in production only)
  const user = auth.currentUser;
  
  // Construct full URL if it's a relative API path
  let fullUrl = url;
  if (url.startsWith('/api')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    // ensure we don't double slash if base ends with / and url starts with /
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    fullUrl = cleanBase ? `${cleanBase}${url}` : url;
  }

  const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
  const disableFirebaseAuth = typeof import.meta !== 'undefined' && (
    (import.meta as any).env?.VITE_DISABLE_FIREBASE_AUTH === '1' ||
    (import.meta as any).env?.VITE_DISABLE_FIREBASE_AUTH === 'true'
  );
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isDev || disableFirebaseAuth) {
    // In development, prefer legacy header auth and avoid sending Authorization
    const devUser = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem('devUserId') || 'demo')
      : 'demo';
    headers["x-user-id"] = devUser;
  } else if (user) {
    // In production: Send Firebase ID token (server should verify with Firebase Admin)
    try {
      const idToken = await user.getIdToken();
      headers["Authorization"] = `Bearer ${idToken}`;
      headers["X-User-ID"] = user.uid;
    } catch (e: any) {
      // Fallback to legacy header if Firebase request fails
      console.warn('[queryClient] Firebase getIdToken failed, falling back to x-user-id:', e?.message || e);
      const devUser = (typeof window !== 'undefined' && window.localStorage)
        ? (localStorage.getItem('devUserId') || 'demo')
        : 'demo';
      headers["x-user-id"] = devUser;
    }
  }

  // If sending FormData, allow the browser to set the proper multipart boundary
  if (options.body && typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    // Surface MFA requirement by triggering the global bus
    const requireMfa = res.headers.get('x-require-mfa');
    if ((res.status === 401 || res.status === 403 || res.status === 423) && requireMfa) {
      triggerMfa();
      // Store this failing request for replay after successful MFA
      const method = options.method || 'GET';
      recordMfaFailedRequest(method, url, { ...options });
    }
    if (res.status >= 500) {
      throw new Error(`${res.status}: ${res.statusText}`);
    }

    let message = `${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      message = errorData.error || errorData.message || message;
    } catch {
      // If parsing fails, use the default message
    }

    throw new Error(message);
  }

  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [url, ...params] = queryKey;
        if (!url || typeof url !== 'string') {
          throw new Error('Invalid query key');
        }
        
        // For array query keys, construct URL with query params
        if (params.length > 0) {
          const urlObj = new URL(url, window.location.origin);
          params.forEach((param, index) => {
            if (param !== undefined && param !== null) {
              urlObj.searchParams.set(`param${index}`, String(param));
            }
          });
          return handleRequest(urlObj.pathname + urlObj.search);
        }
        
        // Ensure URL starts with /api/
        const apiUrl = url.startsWith('/') ? url : `/${url}`;
        return handleRequest(apiUrl);
      },
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  headersOverride?: Record<string, string | undefined>,
): Promise<any> {
  const options: RequestInit = { method };

  if (data instanceof FormData) {
    options.body = data;
  } else if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  if (headersOverride) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(headersOverride)) {
      if (typeof v === 'string') clean[k] = v;
    }
    options.headers = clean;
  }

  return handleRequest(url, options);
}

/** Helper to check if there is a pending MFA-replayable request */
export function hasPendingMfaReplay(): boolean {
  return mfaFailedQueue.length > 0;
}

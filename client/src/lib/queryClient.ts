import { QueryClient } from "@tanstack/react-query";
import { auth } from "./firebase";

async function handleRequest(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  // Get Firebase user for authentication
  const user = auth.currentUser;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (user) {
    // For MVP: Send user ID in custom header
    // In production: Send Firebase ID token and verify server-side with Firebase Admin
    const idToken = await user.getIdToken();
    headers["Authorization"] = `Bearer ${idToken}`;
    headers["X-User-ID"] = user.uid;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
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
        
        return handleRequest(url);
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
): Promise<any> {
  const options: RequestInit = {
    method,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return handleRequest(url, options);
}

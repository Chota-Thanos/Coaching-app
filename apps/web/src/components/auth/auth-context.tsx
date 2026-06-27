"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browserBaseUrl, type StudentFork } from "../../lib/api";

type AuthUser = {
  id: number;
  email: string;
  username: string;
  role: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  forks: StudentFork[];
  forksByArticleId: Map<number, StudentFork>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; username: string; password: string }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshForks: () => Promise<void>;
  isInitialized: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function jsonFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body !== undefined && !isFormDataBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${browserBaseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      if (body) {
        if (typeof body.message === "string") {
          message = body.message;
        } else if (body.error === "validation_error" && Array.isArray(body.issues)) {
          message = body.issues.map((i: any) => i.message).join(" ");
        }
      }
    } catch {
      // Keep the status-based fallback for non-JSON error responses.
    }

    if (response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("coaching_hub_token");
        localStorage.removeItem("coaching_hub_user");
        window.location.reload();
      }
    }
    throw new Error(message);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [forks, setForks] = useState<StudentFork[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setForks([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("coaching_hub_token");
      localStorage.removeItem("coaching_hub_user");
    }
  }, []);

  const refreshForks = useCallback(async () => {
    if (!token) {
      setForks([]);
      return;
    }
    try {
      const records = await jsonFetch<StudentFork[]>("/api/v1/current-affairs/me/forks?limit=100", token);
      setForks(records);
    } catch (err) {
      console.error("Failed to refresh forks:", err);
    }
  }, [token]);

  // Load persisted session on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("coaching_hub_token");
      const storedUser = localStorage.getItem("coaching_hub_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Sync fresh user role/details from DB on load
        jsonFetch<AuthUser>("/api/v1/auth/me", storedToken)
          .then((freshUser) => {
            if (freshUser) {
              setUser(freshUser);
              localStorage.setItem("coaching_hub_user", JSON.stringify(freshUser));
            }
          })
          .catch((err) => {
            console.error("Failed to sync fresh user profile:", err);
          })
          .finally(() => {
            setIsInitialized(true);
          });
      } else {
        setIsInitialized(true);
      }
    } else {
      setIsInitialized(true);
    }
  }, []);

  // Trigger forks refresh after initial state load
  useEffect(() => {
    if (isInitialized && token) {
      void refreshForks();
    }
  }, [isInitialized, token, refreshForks]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await jsonFetch<{ user: AuthUser; access_token: string }>("/api/v1/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setToken(result.access_token);
    setUser(result.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("coaching_hub_token", result.access_token);
      localStorage.setItem("coaching_hub_user", JSON.stringify(result.user));
    }
    const records = await jsonFetch<StudentFork[]>("/api/v1/current-affairs/me/forks?limit=100", result.access_token);
    setForks(records);
  }, []);

  const register = useCallback(async (input: { email: string; username: string; password: string }) => {
    const result = await jsonFetch<{ user: AuthUser; access_token: string }>("/api/v1/auth/register", undefined, {
      method: "POST",
      body: JSON.stringify(input)
    });
    setToken(result.access_token);
    setUser(result.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("coaching_hub_token", result.access_token);
      localStorage.setItem("coaching_hub_user", JSON.stringify(result.user));
    }
    const records = await jsonFetch<StudentFork[]>("/api/v1/current-affairs/me/forks?limit=100", result.access_token);
    setForks(records);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const result = await jsonFetch<{ user: AuthUser; access_token: string }>("/api/v1/auth/google", undefined, {
      method: "POST",
      body: JSON.stringify({ id_token: idToken })
    });
    setToken(result.access_token);
    setUser(result.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("coaching_hub_token", result.access_token);
      localStorage.setItem("coaching_hub_user", JSON.stringify(result.user));
    }
    const records = await jsonFetch<StudentFork[]>("/api/v1/current-affairs/me/forks?limit=100", result.access_token);
    setForks(records);
  }, []);

  const forksByArticleId = useMemo(() => {
    return new Map(forks.map((fork) => [Number(fork.master_article_id), fork]));
  }, [forks]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    forks,
    forksByArticleId,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshForks,
    isInitialized
  }), [forks, forksByArticleId, login, logout, refreshForks, register, loginWithGoogle, token, user, isInitialized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export async function authenticatedPost<T>(path: string, token: string, payload: unknown): Promise<T> {
  return jsonFetch<T>(path, token, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function authenticatedUpload<T>(path: string, token: string, formData: FormData): Promise<T> {
  return jsonFetch<T>(path, token, {
    method: "POST",
    body: formData
  });
}

export async function authenticatedGet<T>(path: string, token: string): Promise<T> {
  return jsonFetch<T>(path, token);
}

export async function authenticatedPut<T>(path: string, token: string, payload: unknown): Promise<T> {
  return jsonFetch<T>(path, token, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function authenticatedPatch<T>(path: string, token: string, payload: unknown): Promise<T> {
  return jsonFetch<T>(path, token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function authenticatedDelete<T>(path: string, token: string): Promise<T> {
  return jsonFetch<T>(path, token, {
    method: "DELETE"
  });
}

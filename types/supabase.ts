// types/supabase.ts

/**
 * Базовые типы для совместимости с supabase-js
 * (урезаны и упрощены, для внутреннего использования pocketsupa)
 */

export interface SupabaseClientOptions {
  auth?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
    storage?: any;
    [key: string]: any;
  };
  db?: {
    schema?: string;
  };
  global?: {
    headers?: Record<string, string>;
    fetch?: typeof fetch;
    [key: string]: any;
  };
  [key: string]: any;
}

// Тип пользователя (user)
export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// Сессия (session)
export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  user: SupabaseUser;
  expires_in?: number;
  expires_at?: number;
  [key: string]: any;
}

// Auth: client заглушка-API
export interface SupabaseAuthClient {
  signUp(options: { email: string; password: string; [key: string]: any }): Promise<{ data: any; error: Error | null }>;
  signInWithPassword(options: { email?: string; phone?: string; password: string }): Promise<{ data: any; error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
  // ... другие методы, если используете
  [key: string]: any;
}

// Storage: client заглушка-API
export interface SupabaseStorageClient {
  from(bucket: string): {
    upload(path: string, file: any, opts?: any): Promise<{ data: any; error: Error | null }>;
    download(path: string, opts?: any): Promise<{ data: any; error: Error | null }>;
    getPublicUrl(path: string, opts?: any): { data: any; error: Error | null };
    // ... другие методы
    [key: string]: any;
  };
  createBucket(name: string, opts?: any): Promise<{ data: any; error: Error | null }>;
  getBucket(name: string): Promise<{ data: any; error: Error | null }>;
  // ... другие методы
  [key: string]: any;
}

// Functions: client заглушка-API
export interface SupabaseFunctionsClient {
  invoke(fn: string, opts?: any): Promise<{ data: any; error: Error | null }>;
  [key: string]: any;
}

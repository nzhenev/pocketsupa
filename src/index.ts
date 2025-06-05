// src/index.ts
import { PocketSupaClient, PocketSupaClientOptions } from "./client";

// Совместимая сигнатура с оригинальным Supabase JS SDK
export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: PocketSupaClientOptions
) {
  // Возвращаем instance заменяющего клиента
  return new PocketSupaClient(supabaseUrl, supabaseKey, options);
}

// (в будущем здесь можно экспортировать типы, совместимые с supabase-js)
export type { PocketSupaClientOptions } from "./client";

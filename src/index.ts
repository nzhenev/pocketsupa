// src/index.ts
import { PocketSupaClient } from "./client";

/**
 * Fully supabase-js compatible createClient function.
 * Instantiates a PocketBase-backed drop-in supabase-js API.
 */
export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: any
) {
  return new PocketSupaClient(supabaseUrl, supabaseKey, options);
}

// API compatibility: export SupabaseClient alias.
export { PocketSupaClient as SupabaseClient };
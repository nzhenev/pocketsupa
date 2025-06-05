// src/client.ts
import type { SupabaseClientOptions, SupabaseAuthClient, SupabaseStorageClient, SupabaseFunctionsClient } from "../types/supabase";
import { DatabaseModule } from "./modules/db";
import { AuthModule } from "./modules/auth";

/**
 * PocketSupaClient: API-compatible implementation of supabase-js Client.
 * All modules and APIs follow supabase-js structure and signatures.
 */
export type PocketSupaClientOptions = SupabaseClientOptions;

export class PocketSupaClient {
  public url: string;
  public key: string;
  public options?: PocketSupaClientOptions;

  constructor(url: string, key: string, options?: PocketSupaClientOptions) {
    this.url = url;
    this.key = key;
    this.options = options;
  }

  /**
   * Database API: supabase.from('table')
   * Returns a signature-compatible query builder.
   */
  from(table: string) {
    // Returns a module implementing the supabase-js API for database interaction
    return new DatabaseModule(this, table);
  }

  /**
   * Auth API: supabase.auth
   * Provides authentication methods (signUp, signInWithPassword, signOut, etc.)
   */
  get auth(): SupabaseAuthClient {
    // Returns the OAuth and email/password API-compatible AuthClient implementation
    return new AuthModule(this);
  }

  /**
   * Storage API: supabase.storage
   * PocketBase-compatible implementation supporting upload, download, getPublicUrl, etc.
   */
  get storage(): SupabaseStorageClient {
    // TODO: Provide a fully compatible storage adapter in place of these stubs
    return {
      from: () => ({
        upload: async (..._args: any[]) => ({ data: null, error: new Error("Not implemented") }),
        download: async (..._args: any[]) => ({ data: null, error: new Error("Not implemented") }),
        getPublicUrl: () => ({ data: null, error: new Error("Not implemented") }),
      }),
      createBucket: async (..._args: any[]) => ({ data: null, error: new Error("Not implemented") }),
      getBucket: async (..._args: any[]) => ({ data: null, error: new Error("Not implemented") }),
      // further methods to be implemented for full compliance
    } as SupabaseStorageClient;
  }

  /**
   * Functions API: supabase.functions
   * Allows calling remote functions (PB custom endpoints).
   */
  get functions(): SupabaseFunctionsClient {
    // TODO: Provide a fully compatible functions adapter in place of this stub
    return {
      invoke: async (..._args: any[]) => ({ data: null, error: new Error("Not implemented") }),
    } as SupabaseFunctionsClient;
  }
}

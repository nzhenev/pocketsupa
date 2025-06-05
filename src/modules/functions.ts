// src/modules/functions.ts
import type { PocketSupaClient } from '../client.js';

export class FunctionsModule {
  private client: PocketSupaClient;

  constructor(client: PocketSupaClient) {
    this.client = client;
  }

  /**
   * Call custom function (PB endpoint) via supabase-style
   * @param fn function name (PB handler at /api/functions/{fn})
   * @param opts  { body, method, headers, ... }
   */
  async invoke(
    fn: string,
    opts?: {
      body?: any;
      method?: string;
      headers?: Record<string, string>;
      [key: string]: any;
    }
  ) {
    // Default: POST, custom allowed
    const method = (opts?.method || (opts?.body ? 'POST' : 'GET')).toUpperCase();
    const url = `${this.client.url}/api/functions/${encodeURIComponent(fn)}`;
    let headers: Record<string, string> = {
      ...(this.client.key ? { 'Authorization': `Bearer ${this.client.key}` } : {}),
      ...(this.client.options?.global?.headers || {}),
      ...(opts?.headers || {}),
    };

    let fetchOpts: RequestInit = { method, headers };
    if (opts?.body !== undefined) {
      // Auto-json if not FormData/Blob
      if (
        typeof opts.body === 'string' ||
        opts.body instanceof Blob ||
        opts.body instanceof ArrayBuffer
      ) {
        fetchOpts.body = opts.body;
      } else if (opts.body instanceof FormData) {
        fetchOpts.body = opts.body;
        delete headers['Content-Type'];
      } else {
        fetchOpts.body = JSON.stringify(opts.body);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
    }

    try {
      const resp = await fetch(url, fetchOpts);
      const contentType = resp.headers.get('Content-Type') || '';
      let data;
      if (contentType.includes('application/json')) data = await resp.json();
      else if (contentType.startsWith('text/')) data = await resp.text();
      else data = await resp.arrayBuffer();

      if (!resp.ok) {
        return { data: null, error: new Error((typeof data==='object'&&data?.message)||resp.statusText) };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
}

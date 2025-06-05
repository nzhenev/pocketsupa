// src/modules/auth.ts

import type { PocketSupaClient } from '../client.js';

export class AuthModule {
  private client: PocketSupaClient;
  private _session: null | {
    access_token: string;
    user: any;
    user_id: string;
  } = null;

  constructor(client: PocketSupaClient) {
    this.client = client;
  }

  // SUPABASE: signUp({ email, password, ... })
  async signUp({ email, password, ...rest }: { email: string, password: string, [key: string]: any }) {
    // PB: POST /api/collections/users/records
    const url = `${this.client.url}/api/collections/users/records`;
    const body = { email, password, ...rest };
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        let errData = null; try { errData = await resp.json(); } catch {};
        return { data: null, error: new Error((errData && errData.message) || resp.statusText) };
      }
      const data = await resp.json();
      return { data: { user: data, user_id: data.id }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  // SUPABASE: signInWithPassword({ email, password })
  async signInWithPassword({ email, password }: { email: string, password: string }) {
    // PB: POST /api/collections/users/auth-with-password
    const url = `${this.client.url}/api/collections/users/auth-with-password`;
    const body = { identity: email, password };
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        let errData = null; try { errData = await resp.json(); } catch {};
        return { data: null, error: new Error((errData && errData.message) || resp.statusText) };
      }
      const data = await resp.json();
      this._session = {
        access_token: data.token,
        user: data.record,
        user_id: data.record.id,
      };
      return { data: { session: this._session, user: data.record }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  // SUPABASE: signOut()
  async signOut() {
    this._session = null;
    return { error: null };
  }

  // SUPABASE: getSession()
  async getSession() {
    return { data: this._session, error: null };
  }

  // SUPABASE: getUser()
  async getUser() {
    if (!this._session)
      return { data: { user: null }, error: null };
    // PB токен можно проверить: GET /api/collections/users/records/{id} + Auth
    const url = `${this.client.url}/api/collections/users/records/${this._session.user_id}`;
    try {
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this._session.access_token}` },
      });
      if (!resp.ok) {
        let errData = null; try { errData = await resp.json(); } catch {};
        return { data: null, error: new Error((errData && errData.message) || resp.statusText) };
      }
      const user = await resp.json();
      return { data: { user }, error: null };
    } catch(e: any) {
      return { data: null, error: e};
    }
  }

  // SUPABASE: updateUser({ ... })
  async updateUser(fields: Record<string, any>) {
    if (!this._session)
      return { data: null, error: new Error('Not signed in') };
    const url = `${this.client.url}/api/collections/users/records/${this._session.user_id}`;
    try {
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._session.access_token}`
        },
        body: JSON.stringify(fields)
      });
      if (!resp.ok) {
        let errData = null; try { errData = await resp.json(); } catch {};
        return { data: null, error: new Error((errData && errData.message) || resp.statusText) };
      }
      const user = await resp.json();
      // обновим сохраненную user
      this._session.user = user;
      return { data: { user }, error: null };
    } catch(e: any) {
      return { data: null, error: e};
    }
  }
}

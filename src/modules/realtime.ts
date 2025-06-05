// src/modules/realtime.ts

import type { PocketSupaClient } from '../client.js';

type EventTypes = 'INSERT' | 'UPDATE' | 'DELETE' | '*' | string;

type SupabaseRealtimeCallback = (payload: any) => void;

interface ChannelLike {
  on(event: EventTypes, opts: any | SupabaseRealtimeCallback, cb?: SupabaseRealtimeCallback): ChannelLike;
  subscribe(cb?: (status: 'SUBSCRIBED' | 'CLOSED' | 'ERROR') => void): ChannelLike;
  unsubscribe(): void;
}

type EventListener = {
  event: EventTypes;
  filter?: any;
  cb: SupabaseRealtimeCallback;
};

class RealtimeChannel implements ChannelLike {
  private client: PocketSupaClient;
  private channel: string;
  private listeners: EventListener[] = [];
  private sse: EventSource | null = null;
  private active = false;
  private statusCb?: (status: string) => void;

  constructor(client: PocketSupaClient, channel: string) {
    this.client = client;
    this.channel = channel;
  }

  // Supabase-style channel.send({type, event, payload}) — демо/имитация топика через PB функции/webhook
  async send({ type = 'broadcast', event, payload }: { type?: string, event: string, payload: any }) {
    // Реализовано через кастомный PB endpoint /api/functions/broadcast
    const url = `${this.client.url}/api/functions/broadcast`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.client.key ? { 'Authorization': `Bearer ${this.client.key}` } : {})
        },
        body: JSON.stringify({ channel: this.channel, type, event, payload })
      });
      if (!resp.ok) {
        return { error: new Error('Broadcast failed') };
      }
      return { success: true };
    } catch (e: any) {
      return { error: e };
    }
  }

  on(event: EventTypes, opts: any | SupabaseRealtimeCallback, cb?: SupabaseRealtimeCallback): RealtimeChannel {
    let callback: SupabaseRealtimeCallback, filter: any;
    if (typeof opts === 'function') {
      callback = opts;
      filter = undefined;
    } else {
      callback = cb!;
      filter = opts;
    }
    this.listeners.push({ event, filter, cb: callback });
    return this;
  }

  subscribe(cb?: (status: 'SUBSCRIBED' | 'CLOSED' | 'ERROR') => void): RealtimeChannel {
    if (this.active) return this;
    this.active = true;
    this.statusCb = cb;

    // PocketBase: SSE endpoint, subscribe to event stream (optionally filter to collection/topic)
    const params = new URLSearchParams();
    if (this.channel) params.append('topic', this.channel);

    const url = `${this.client.url.replace(/\/+$/, '')}/api/realtime?${params.toString()}`;

    this.sse = new EventSource(url);

    this.sse.onopen = () => {
      this.statusCb?.('SUBSCRIBED');
    };
    this.sse.onerror = (e) => {
      this.statusCb?.('ERROR');
      this.unsubscribe();
    };
    this.sse.onmessage = (ev) => {
      let data: any;
      try { data = JSON.parse(ev.data); } catch { return; }
      // PB emits: { action: "create"|"update"|"delete", record, collection, key, ... }
      const sbaseTypeMap = { create: 'INSERT', update: 'UPDATE', delete: 'DELETE' };
      const supaEvent = sbaseTypeMap[data.action] || data.action?.toUpperCase() || '*';

      // Call matching listeners (supabase: wildcard, by type, by key/field etc.)
      for (const listener of this.listeners) {
        if (
          listener.event === '*' ||
          listener.event === supaEvent ||
          listener.event === data.action ||
          listener.event === data.key
        ) {
          // Filter if filter object/function provided
          let pass = true;
          if (listener.filter) {
            // filter logic: can pass collection name, recordId, custom CB etc.
            if (typeof listener.filter === 'function') {
              pass = !!listener.filter(data);
            } else if (typeof listener.filter === 'string') {
              // match collection name or recordId string
              pass = (data.collection === listener.filter || data.record?.id === listener.filter);
            } else if (typeof listener.filter === 'object') {
              for (const k in listener.filter) {
                if (listener.filter[k] !== data[k]) pass = false;
              }
            }
          }
          if (pass) {
            listener.cb({
              eventType: supaEvent,
              ...data
            });
          }
        }
      }
    };
    return this;
  }

  unsubscribe() {
    this.active = false;
    if (this.sse) {
      this.sse.close();
      this.sse = null;
      this.statusCb && this.statusCb('CLOSED');
    }
    this.listeners = [];
  }
}

export class RealtimeModule {
  private client: PocketSupaClient;
  private _channels: Map<string, RealtimeChannel> = new Map();

  constructor(client: PocketSupaClient) {
    this.client = client;
  }

  // Supabase: .channel('room1')
  channel(name: string): ChannelLike {
    if (this._channels.has(name)) return this._channels.get(name)!;
    const chan = new RealtimeChannel(this.client, name);
    this._channels.set(name, chan);
    return chan;
  }

  // Supabase: .from('table').on('INSERT', cb) — sugar for .channel(table)
  from(table: string): ChannelLike {
    return this.channel(table);
  }

  // Removes channel by reference or name
  removeChannel(chan: ChannelLike | string) {
    let name: string;
    if (typeof chan === 'string') {
      name = chan;
    } else {
      // Try to match by channel name (internal only)
      for (const [k, v] of this._channels) if (v === chan) { name = k; break; }
      return;
    }
    const c = this._channels.get(name);
    if (c) {
      c.unsubscribe();
      this._channels.delete(name);
    }
  }

  removeAllChannels() {
    for (const c of this._channels.values()) c.unsubscribe();
    this._channels.clear();
  }

  // List all channel refs
  getChannels() {
    return [...this._channels.values()];
  }
}

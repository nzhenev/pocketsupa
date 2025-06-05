// src/modules/db.ts
import type { PocketSupaClient } from '../client.js';
import { pbQuery, filter as pbFilter } from '../query/index.js';

// Database module: supabase.from('table')
export class DBModule {
  private client: PocketSupaClient;
  private table: string;
  private q: ReturnType<typeof pbQuery<any>>;

  constructor(client: PocketSupaClient, table: string) {
    this.client = client;
    this.table = table;
    this.q = pbQuery<any>();
  }

  // --- Chainable filter API (supabase style -> pbQuery)

  eq(field: string, value: any)          { this.q = this.q.equal(field, value); return this; }
  neq(field: string, value: any)         { this.q = this.q.notEqual(field, value); return this; }
  lt(field: string, value: any)          { this.q = this.q.lessThan(field, value); return this; }
  lte(field: string, value: any)         { this.q = this.q.lessThanOrEqual(field, value); return this; }
  gt(field: string, value: any)          { this.q = this.q.greaterThan(field, value); return this; }
  gte(field: string, value: any)         { this.q = this.q.greaterThanOrEqual(field, value); return this; }
  like(field: string, value: any)        { this.q = this.q.like(field, value); return this; }
  notLike(field: string, value: any)     { this.q = this.q.notLike(field, value); return this; }
  in(field: string, values: any[])       { this.q = this.q.in(field, values); return this; }
  notIn(field: string, values: any[])    { this.q = this.q.notIn(field, values); return this; }
  between(field: string, a: any, b: any)     { this.q = this.q.between(field, a, b); return this; }
  notBetween(field: string, a: any, b: any)  { this.q = this.q.notBetween(field, a, b); return this; }
  is(field: string, v: any)              { (v == null) ? (this.q = this.q.isNull(field)) : (this.q = this.q.eq(field, v)); return this; }
  and()   { this.q = this.q.and(); return this; }
  or()    { this.q = this.q.or(); return this; }
  group(f: (q: any) => any) { this.q = this.q.group(f); return this; }

  // --- Supabase modifiers ---
  private _orderBy: { field: string, ascending: boolean, referencedTable?: string }[] = [];
  private _range: [number, number] | null = null;
  private _distinctField: string | null = null;

  order(field: string, opts?: { ascending?: boolean, referencedTable?: string }) {
    this._orderBy.push({ field, ascending: (opts?.ascending !== false), referencedTable: opts?.referencedTable });
    return this;
  }
  range(start: number, end: number) {
    this._range = [start, end];
    return this;
  }
  distinct(field: string) {
    this._distinctField = field;
    return this;
  }

  // --- SELECT ---
  async select(columns?: string | string[], options?: any) {
    let url = `${this.client.url}/api/collections/${this.table}/records`;

    let params: Record<string, string> = {};
    if (columns) {
      if (Array.isArray(columns)) params.fields = columns.join(',');
      else if (typeof columns === 'string' && columns !== '*') params.fields = columns;
    }
    if (options && typeof options === 'object') {
      if (options.limit) params.perPage = String(options.limit);
      if (options.offset && !params.page) params.page = String(1 + Math.floor(options.offset / (options.limit || 30)));
    }
    // --- PB FILTER ---
    const filterStr = this.q.build(pbFilter);
    if (filterStr && typeof filterStr === 'string' && filterStr.length) params.filter = filterStr;

    const qstring = Object.keys(params).length
      ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    url += qstring;

    let response;
    try {
      response = await fetch(url, {
        headers: {
          ...(this.client.options?.global?.headers || {}),
          'Authorization': this.client.key ? `Bearer ${this.client.key}` : ''
        }
      });
    } catch (err: any) {
      return { data: null, error: err };
    }
    if (!response.ok) {
      let errData: any = null;
      try { errData = await response.json(); } catch (_) { /* ignore */ }
      return { data: null, error: new Error(`PB error: ${response.status} ${response.statusText}: ${(errData && errData.message) || ''}`) };
    }
    let json;
    try {
      json = await response.json();
    } catch (err: any) {
      return { data: null, error: new Error('Invalid JSON in PB response') };
    }
    let data = Array.isArray(json.items) ? json.items : [];
    return { data, error: null };
  }

  // --- INSERT ---
  async insert(values: object | object[]) {
    const url = `${this.client.url}/api/collections/${this.table}/records`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.client.options?.global?.headers || {}),
          'Authorization': this.client.key ? `Bearer ${this.client.key}` : ''
        },
        body: JSON.stringify(Array.isArray(values) ? values : [values])
      });
      if (!response.ok) {
        let errData = null;
        try { errData = await response.json(); } catch {};
        return { data: null, error: new Error('PB insert error: ' + ((errData && errData.message) || response.statusText)) };
      }
      const data = await response.json();
      return { data: data.items || data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  // --- UPDATE ---
  async update(values: object) {
    // поддержка batch/условий позже; сейчас — update по фильтру id и/или первой найденной записи
    const filterStr = this.q.build(pbFilter);
    let id: string | undefined = undefined;
    if (/id=['\"]?([0-9a-zA-Z_-]+)['\"]?/.test(filterStr)) {
      id = filterStr.match(/id=['\"]?([0-9a-zA-Z_-]+)['\"]?/)[1];
    }
    if (!id)
      return { data: null, error: new Error('Update currently supports only filter by id') };
    const url = `${this.client.url}/api/collections/${this.table}/records/${encodeURIComponent(id)}`;
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(this.client.options?.global?.headers || {}),
          'Authorization': this.client.key ? `Bearer ${this.client.key}` : ''
        },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        let errData = null;
        try { errData = await response.json(); } catch {}; 
        return { data: null, error: new Error('PB update error: ' + ((errData && errData.message) || response.statusText)) };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  // --- DELETE ---
  async delete() {
    const filterStr = this.q.build(pbFilter);
    let id: string | undefined = undefined;
    if (/id=['\"]?([0-9a-zA-Z_-]+)['\"]?/.test(filterStr)) {
      id = filterStr.match(/id=['\"]?([0-9a-zA-Z_-]+)['\"]?/)[1];
    }
    if (!id)
      return { data: null, error: new Error('Delete currently supports only filter by id') };
    const url = `${this.client.url}/api/collections/${this.table}/records/${encodeURIComponent(id)}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...(this.client.options?.global?.headers || {}),
          'Authorization': this.client.key ? `Bearer ${this.client.key}` : ''
        },
      });
      if (!response.ok) {
        let errData = null;
        try { errData = await response.json(); } catch {};
        return { data: null, error: new Error('PB delete error: ' + ((errData && errData.message) || response.statusText)) };
      }
      return { data: { success: true }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
}

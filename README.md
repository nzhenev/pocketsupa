# pocketsupa

[![npm version](https://img.shields.io/npm/v/pocketsupa.svg?style=flat-square)](https://npmjs.com/package/pocketsupa)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A drop-in [Supabase JS SDK](https://supabase.com/docs/reference/javascript) replacement running on top of [PocketBase](https://pocketbase.io/). Use **all Supabase client features** with a PocketBase backend.

> **Seamless Supabase→PocketBase migration — simply change your import!**

---

## Features

- Full Supabase JS API signature compatibility (`createClient`, `.from`, `.auth`, `.storage`, `.functions`, `.realtime`)
- CRUD, chainable filters, realtime, storage, functions — all mapped to PocketBase REST API
- Schema sync: convert Supabase/Postgres migrations to PocketBase collections with one command
- Designed for Bun, Node & TypeScript, works from browser and server
- Fast, universal alternative to Supabase for local, offline, or resource-constrained deployments

---

## Project Status & Roadmap

**Status:** 🚀 Active development. Ready for real projects. API is stable for the supported feature set.

- [x] Drop-in replacement for supabase-js: `createClient`, `.from`, `.auth`, `.storage`, `.functions`, `.realtime`
- [x] Full compatibility with PocketBase REST API and filter syntax
- [x] Advanced filtering, ordering, pagination, and error handling
- [x] Auth: registration, login, session, update, strict supabase error envelopes
- [x] Storage: upload/download/getPublicUrl (file fields in PB)
- [x] Realtime & broadcast: channel, on, from, subscribe, presence (via PB events)
- [x] Automatic migration: Supabase SQL migrations → PocketBase collections (safe, idempotent)
- [x] Admin-safe: never modifies or deletes existing PB collections/data

**Planned/Upcoming:**
- [ ] Native OAuth/SSO/external providers (as PB backend matures)
- [ ] Automated migration with advanced relation/cascade support
- [ ] Bulk/batch update/delete, richer query batching
- [ ] Live subscription/channel presence API parity
- [ ] PB Console plugin for preview, diff & sync of migrations
- [ ] Automated integration tests on reference projects
- [ ] Developer-friendly error/debug output and devtools

**Need a feature or want to help? Open an [issue](https://github.com/<YOUR_GITHUB>/pocketsupa/issues) or PR!**

---

## Installation

```sh
npm install pocketsupa
# or
bun add pocketsupa
```

---

## Usage

Minimal example:

```ts
import { createClient } from 'pocketsupa';

const supabase = createClient('http://localhost:8090', '');

// Select users
const { data, error } = await supabase.from('users').select('*');

// Auth (sign-up, login)
await supabase.auth.signUp({ email: 'you@site.com', password: 'secret' });
await supabase.auth.signInWithPassword({ email: 'you@site.com', password: 'secret' });

// Storage
await supabase.storage.from('avatars').upload('recordId/avatar/photo.png', file);

// Functions
await supabase.functions.invoke('myFunc', { body: { foo: 1 } });

// Realtime (subscribe to events)
const channel = supabase.realtime.channel('testroom')
  .on('INSERT', payload => console.log('New:', payload))
  .subscribe();
```

---

## Migration: Sync Supabase schema to PocketBase

Automatically introspect your Supabase/Postgres SQL migrations and create matching collections in PocketBase:

```sh
PB_API='http://localhost:8090' PB_ADMIN_TOKEN='<PB_ADMIN_TOKEN>' bun run src/schema/syncToPB.ts path/to/supabase/migrations http://localhost:8090 <PB_ADMIN_TOKEN>
```

See [`Quickstart.md`](./Quickstart.md) for more detail and advanced usage.

---

## Limitations

- No SQL Row Level Security (RLS); use PocketBase collection rules and permissions
- No stored procedures, triggers, or Postgres extensions — use PB functions
- No automatic file/image transformations (PB supports direct upload/custom endpoints)
- No advanced SQL (joins, recursive, cross-schema queries)
- OAuth/external login support is experimental (PB backend feature-dependent)

---

## License

[MIT](./LICENSE)

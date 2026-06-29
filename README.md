# Store POS Assessment

React Native tablet POS app for multi-device retail stores — offline-capable, sync-aware, and production-oriented.  
**Scope:** All mobile work documented below. Backend was read-only per assessment brief.

---

## Executive summary

The legacy mobile app worked in development but was not field-ready: duplicate sync listeners, no offline path, no conflict handling, and several API mismatches. We rebuilt the reliability layer around a **single sync orchestrator**, **domain-scoped Zustand stores**, and **AsyncStorage caching**, then aligned cart/order flows with backend behaviour.

All four required features are implemented: **offline cache**, **real-time sync**, **409 conflict resolution**, and **background incremental sync**.

---

## Assessment requirements — status

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Offline cache | Done | AsyncStorage + hydrate-first load; cart/orders cached |
| Real-time sync | Done | WebSocket + 5s poll fallback via `SyncManager` |
| Conflict resolution (409) | Done | Server-wins; local version synced; user alerted |
| Background sync | Done | `GET /sync?since=N` on foreground + reconnect |
| Bug fixes | Done | Cart race, search, orders, API mismatches, memory leaks |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  UI — expo-router (tabs + product/order detail)         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  State — Zustand                                        │
│  productStore │ cartStore │ orderStore │ syncStore      │
│  toastStore                                             │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────┐
│ services/     │   │ SyncManager     │   │ AsyncStorage │
│ api, cache,   │   │ WS + poll +     │   │ products,    │
│ network, sync │   │ NetInfo +       │   │ cart, orders │
└───────────────┘   │ AppState        │   └──────────────┘
                    └─────────────────┘
```

| Layer | Responsibility |
|-------|----------------|
| **Screens** | Render state, user actions, offline banners |
| **Stores** | Domain logic, API/cache coordination |
| **Services** | HTTP client, cache I/O, sync math, search orchestration |
| **SyncManager** | One place for connectivity, WebSocket, polling, foreground refresh |

**Why this shape:** One sync orchestrator avoids duplicate listeners (the main cause of leaks and double-updates in the original app). Domain stores keep screens thin and make behaviour predictable when 10+ devices share a store catalog.

Data flow for new engineers: **Screen → Store → Service → API/Cache**, with sync side-effects centralized in `SyncManager`.

---

## What we found (original issues)

### Stability & memory
- Duplicate sync hooks per screen → duplicate WebSocket timers and state updates.
- WebSocket had no reconnect or handler cleanup.
- Module-level image URL cache grew without bound during long shifts.
- Cart `deviceId` was used before async initialization completed.

### API / data mismatches
- No `GET /products/:id` — detail screen needed cursor-pagination workaround.
- Order status is `draft` | `success` | `failed`, not `paid`.
- No server-side search endpoint; search had to be client-side over loaded data.

### Missing product features
- No offline cache, WebSocket-driven updates, 409 handling, or incremental `/sync`.

---

## What we built & fixed

### 1. Offline cache
- **AsyncStorage** for products (with cursor), categories, tags, cart, and orders.
- `loadProducts()` hydrates from cache first; network failure keeps cached data visible with an offline banner.
- Cart and orders support offline mutations with sync on reconnect.
- Pay and Place Order are gated when offline.

### 2. Real-time sync
- **`SyncManager`** (root layout) owns exactly one WebSocket, poll interval, NetInfo listener, and foreground handler.
- Events applied via `applyEventsToState()` — no full catalog reload on bump.
- WebSocket reconnect with proper socket disposal on cleanup.

### 3. Conflict resolution — server wins
On **409** with `current_version`:
1. Local product version is updated to the server value.
2. Conflict is recorded in `syncStore.pendingConflicts` (capped at 100).
3. User sees an alert on product detail.

**Rationale:** Version numbers are authoritative on the server. Server-wins avoids split-brain across tablets. The user is informed and can bump again on the correct base version.

### 4. Background / incremental sync
- `GET /sync?since=N` on poll (5s) and on foreground/reconnect.
- `refreshSilently()` refreshes categories/tags and runs sync **without** replacing paginated product pages (fixes reconnect wiping loaded catalog pages).

### 5. Cart & orders
- Shared `ensureDeviceId()` promise — no race on first add-to-cart.
- Offline cart add/remove/update with server reconciliation via `syncWithServer()`.
- `placeOrder()` aligned with backend: ensure cart row exists, sync items, then `POST /orders`.
- Cart cleared on server after successful order (backend does not empty cart automatically).
- Orders list with pull-to-refresh, cached fallback, correct status colours.

### 6. Search & product detail
- Debounced search with stale-request guard; searches merged cache + in-memory products offline.
- `productSearch.ts` ready for backend `?search=` + `search_applied: true` when available.
- Product detail fetches via cursor API when product not yet paginated into store.

### 7. Reliability & UX polish
- **Memory:** WebSocket/poll cleanup, async unmount guards, conflict array cap, FlatList tuning (`removeClippedSubviews`, window size).
- **Images:** `ProductImage` loads picsum with skeleton placeholder; falls back to skeleton offline/on error.
- **Toast:** Bottom toast on add-to-cart (`toastStore` + `Toast` component).
- **Config:** API/WS URLs auto-resolve from Expo dev host (simulator + physical device).

---

## Readability

| Convention | Location |
|------------|----------|
| Domain stores | `store/productStore`, `cartStore`, `orderStore` |
| I/O at the edge | `services/api.ts`, `services/cache.ts` — screens never call `fetch` directly |
| Sync in one file | `components/SyncManager.tsx` |
| Shared types | `types/index.ts` |
| Backend quirks | Inline comments in `cartStore.ts` (`placeOrder`, cart sync) |

Folder layout: `services/` · `store/` · `components/` · `hooks/` · `app/` · `types/`

---

## Scalability

### What scales today
- **5,000 products:** Cursor pagination (50/page) — memory grows with scroll, not upfront.
- **Multi-device sync:** WebSocket push + poll fallback; incremental `/sync` avoids full reloads.
- **Cache merge:** `upsertProductsCache()` merges by ID instead of blind overwrite.
- **One sync connection per app instance** — appropriate for 10 tablets per store.

### Known limits & production next steps

| Area | Current limit | Next step |
|------|---------------|-----------|
| AsyncStorage | Slow JSON I/O at large catalog size | SQLite / Realm with indexed queries |
| `computeSyncSince()` uses `min()` | Poll can re-fetch many old events | Per-entity-type sync cursor |
| Search | Client-side over loaded/cached rows | Backend `GET /products?search=` (mobile wired) |
| Images | Remote picsum URLs | CDN + `expo-image` with bounded cache |
| Offline bumps | Not queued | Outbox pattern with replay + conflict merge |

---

## Intentionally deferred

| Item | Reason |
|------|--------|
| Search all 5,000 products | Requires backend search API; mobile integration exists |
| Category → product filter | Categories UI selects ID but does not filter products tab |
| `order_update` WebSocket | Backend broadcasts on pay; mobile only handles bump events |
| Category/tag bump 409 UI | Only product bump has user-facing conflict alert |
| Conflict history screen | `pendingConflicts` stored but no UI |
| Offline bump queue | Needs outbox + merge strategy beyond server-wins |
| Native background modules | Bonus scope (`mobile/native/`) — not implemented |
| Backend changes | Out of scope per brief |

### If we had more time (recommended priority)

1. **Per-type sync cursor** — stop poll amplification on long-running tablets.
2. **`order_update` handler** — live payment status across devices.
3. **Category filter on products tab** — complete categories UX.
4. **Backend search API** — full-catalog search (mobile prepared).
5. **API reachability check** — Wi‑Fi on vs backend reachable.
6. **Product detail → cache upsert** — offline revisit without re-fetch.
7. **Conflict review screen** — surface `pendingConflicts` for store managers.
8. **Native background sync modules** — bonus Kotlin/Obj-C.

---

## Getting started

### Backend

```bash
cd backend
go run . --seed     # first time: populates 5000 products, then exits
go run .            # starts API on :8080
```

REST API + WebSocket at `ws://localhost:8080/ws`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

The app auto-detects the Metro host for API/WS URLs (`mobile/constants/config.ts`). Ensure the backend runs on `:8080` on the same machine as Metro. Dev log shows: `[POS] API_URL: http://<lan-ip>:8080`.

---

## How to verify

| Scenario | Expected result |
|----------|-----------------|
| Load products, go offline | Cached list + banner; search works on cached rows |
| Bump on device A | Device B version updates within seconds (WS or poll) |
| Stale bump → 409 | Server version applied + conflict alert |
| App background → foreground | Incremental sync; paginated products **not** reset to page 1 |
| Add to cart | Bottom toast; cart persists offline |
| Place order | Order created; cart emptied |
| Pay (online) | Status updates to success/failed |

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | Cursor-paginated list (`?after=<cursor>&limit=50`) |
| POST | `/products/:id/bump` | Bump product version; body `{"expected_version": N}` — **409** on mismatch |
| GET | `/categories` | Full category tree |
| POST | `/categories/:id/bump` | Same conflict-check pattern |
| GET | `/tags` | All tags |
| POST | `/tags/:id/bump` | Same conflict-check pattern |
| POST | `/cart` | `{"action":"add"/"remove"/"update"/"list", "device_id":"...", ...}` |
| POST | `/orders` | Create order from cart — starts in `draft` |
| GET | `/orders` | List orders (`?device_id=...` optional) |
| POST | `/orders/:id/pay` | Attempt payment — randomly succeeds or fails |
| GET | `/sync` | Changed entities since version N (`?since=<version>`) |
| GET | `/ws` | WebSocket — broadcasts bump events |

### Version bump conflict example

```json
POST /products/42/bump
{ "expected_version": 3 }

// If server version differs:
HTTP 409
{ "error": "version_conflict", "current_version": 6 }
```

---

## Original assessment brief

### Scenario

Stores run tablet POS terminals — each store has 10+ devices showing a live catalog of products, categories, and tags. The previous app had stability problems in the field: freezes, sluggishness after hours of uptime, and sync drift when internet drops briefly.

### Required features (all implemented)

1. **Offline cache** — load last known data from local storage; silent refresh when network returns.
2. **Real-time sync** — WebSocket broadcasts `{ "type": "product_bump", "entity_id": 42, "version": 7, ... }`; update local state without full reload.
3. **Conflict resolution** — handle 409 when offline bump meets newer server version (server-wins strategy above).
4. **Background sync** — `GET /sync?since=N` on foreground/reconnect; apply only changed entities.

### Bonus

Native modules: see `mobile/native/README.md` (Kotlin + Objective-C) — not implemented.

### Submission

- Push to a public GitHub/Bitbucket repo and share the link.
- This README documents findings, fixes, conflict strategy, and deferred work.

**Time budget:** 4–6 hours.

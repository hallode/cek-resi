# AGENTS.md — gateway-ts

Pintu masuk publik (port `8080`): serve `web/` dan proxy path `/api/*` ke service pemilik. Aturan umum: [../../AGENTS.md](../../AGENTS.md).

- TypeScript dijalankan langsung oleh Node 24 (type stripping): hanya sintaks *erasable* (tanpa `enum`/`namespace`), import pakai ekstensi `.ts`. **Tanpa dependency runtime**; devDeps hanya `typescript`, `@types/node`, `@biomejs/biome`.
- Task: `mise run {dev,test,lint,fmt}:gateway`.
- Env: `PORT`, `WEB_DIR` (default `../../web`), `TRACKING_URL`, `ONGKIR_URL`.
- `src/app.ts` — `createApp(config)` + tabel `ROUTES` (path publik → upstream). Menambah path baru milik service lain = satu baris di `ROUTES` + entri upstream.
- `src/proxy.ts` — status & body upstream diteruskan apa adanya; timeout 3 detik atau koneksi gagal → `502 {"error":"layanan <nama> tidak tersedia"}`.
- `src/static.ts` — static file dengan proteksi path traversal.
- `src/spectest.ts` — harness spec (test-only). Spec yang diimplementasikan didaftarkan di `SPEC_FILES` pada `test/spec.test.ts`.
- Test pakai upstream tiruan (`test/helpers.ts`); jangan bergantung pada service lain yang hidup.
- Sudah di-proxy: tracking (`/api/couriers`, `/api/track`) dan ongkir (`/api/ongkir`, `/api/ongkir/cities`, [004](../../specs/004-ongkir/spec.md)).
- Rencana: deteksi kurir & bulk ([002](../../specs/002-courier-detection/spec.md), [003](../../specs/003-bulk-tracking/spec.md)).

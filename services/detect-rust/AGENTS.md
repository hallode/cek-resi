# AGENTS.md — detect-rust

Deteksi kurir dari pola nomor resi (port `8082`). Aturan umum: [../../AGENTS.md](../../AGENTS.md). Spec: [002](../../specs/002-courier-detection/spec.md).

- Stack: `axum` + `tokio` + `serde`. Edition 2024. Clippy dengan `-D warnings`.
- Task: `mise run {dev,test,lint,fmt}:detect`.
- `src/lib.rs` — `app()` mengembalikan `Router` (dites in-process); `src/main.rs` hanya bind port + serve.
- `tests/spectest/mod.rs` — harness spec; spec yang diimplementasikan didaftarkan di `SPEC_FILES` pada `tests/spec.rs`.
- Status: baru `/health`. `/api/detect` + tabel pola belum dibuat (spec 002).

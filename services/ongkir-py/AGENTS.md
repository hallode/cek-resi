# AGENTS.md — ongkir-py

Kalkulator ongkir dummy (port `8083`). Aturan umum: [../../AGENTS.md](../../AGENTS.md). Spec: [004](../../specs/004-ongkir/spec.md).

- Stack: FastAPI + uvicorn, Python 3.12, dikelola `uv` (`uv.lock` di-commit; `uv sync --locked`). Lint/format: `ruff`.
- Task: `mise run {dev,test,lint,fmt}:ongkir`.
- Error harus berformat `{"error": "..."}` (K2). Validasi query param manual (terima `str | None`), karena validasi otomatis FastAPI menghasilkan 422 dengan format lain.
- `tests/spectest.py` — harness spec; spec yang diimplementasikan didaftarkan di `SPEC_FILES` pada `tests/test_spec.py`.
- Status: baru `/health`. Kota, tarif, dan rumus (spec 004) belum dibuat.

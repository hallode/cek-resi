# Plan 004 — Cek Ongkir (shipping cost check)

| | |
|---|---|
| Spec | [specs/004-ongkir/spec.md](../../specs/004-ongkir/spec.md) |
| Test vectors | [specs/004-ongkir/cases.json](../../specs/004-ongkir/cases.json) |
| Owning service | `ongkir-py` (Python) |
| Other services | `gateway-ts` (proxy `/api/ongkir*`), `web/` |
| Depends on | 000 — implemented except CI (repo at `7bee66d`) |
| Plan status | Implemented |

Spec 004 already exists (Draft) with 17 cases. The numbers in `cases.json` were checked against R2–R4 and are consistent. This plan covers a spec review first, then implementation.

Note: user-facing strings (error messages, UI labels) stay in Indonesian because the spec and AGENTS.md require it. This plan is written in English.

## Repo state this plan builds on

Updated after pulling `7bee66d`. Spec 000 has landed, so the skeleton work is done.

| Area | What exists now | What 004 adds |
|---|---|---|
| `services/ongkir-py` | FastAPI app with `/health` only; `uv` + `ruff` + `pytest` + `httpx`; harness `tests/spectest.py`; `tests/test_spec.py` with a `SPEC_FILES` list; own `AGENTS.md` | cities, tariffs, pricing, validation, two endpoints |
| `services/gateway-ts` | `createApp`, `Upstream = "tracking"`, exact-path `ROUTES` table, 3 s timeout + 502, fake-upstream test helpers | `ongkir` upstream + two routes |
| Tooling | `mise.toml` (replaces the Makefile): `mise run {setup,dev,test,lint,fmt}:ongkir`; `ONGKIR_URL` already set | nothing |
| `web/` | static `index.html`, `app.js`, `style.css`, served by the gateway | Cek Ongkir tab |
| CI | none (`.github/` does not exist; open item of 000) | nothing — out of scope |

## Review checklist

Four items, all open until the user ticks them. Under each: the agent's review result.

- [x] **1. Steps fit the spec, no feature added**
  - Agent review: **pass.** Every step traces to a spec section. The step 0 items are clarifications, not features. CI is out of scope (000 owns it). Skeleton work is dropped because it already exists.
- [x] **2. Files touched make sense**
  - Agent review: **pass.** See "Files touched". Everything is in files the new structure assigns to 004, plus the one-row gateway change. The old limit ("web tab untestable until the gateway exists") is gone: `mise run dev` serves the whole stack.
- [x] **3. There is a test plan for every definition of done**
  - Agent review: **pass.** See "DoD → test". The tab's pure logic (price and ETD formatting, cheapest-row pick) gets a `node:test`; the rendering itself is checked by five manual scenarios. "004 cases via the gateway" is covered by a fake-upstream proxy test plus a manual check, not by a live-service run (see step 2).
- [x] **4. No risky change without a reason**
  - Agent review: **pass, one open decision.** See "Risky changes". Step 0 still needs your decision: apply the spec clarifications, or implement against the current spec as is.

## 0. Gate: spec review (before any code)

Per AGENTS.md, change `spec.md` + `cases.json` first. Everything below is a clarification, not a feature. **Open decision:** apply these, or skip them and implement against the current spec (the lenient `int()` parsing would then be handled in code, and the other ambiguities stay undefined).

- [x] **Validation order.** The spec doesn't say which error wins when several inputs are wrong. Proposal: missing params → origin → destination → weight → partial dimensions → dimension range (the error-table order). *Reason:* without it each language may differ.
- [x] **Strict integer parsing** `^[0-9]+$` for `weight` and dimensions. *Reason:* Python `int()` accepts `"1_000"`, `" 5 "`, `"+5"`.
- [x] **Extra cases** in `cases.json`: `weight=1_000`, `weight=-5`, `length=abc`, `height=0`, `origin=` (empty), volumetric tie (`units == weight*6`).
- [x] Ask the user to approve the spec (status **Approved**). The agent does not change the status itself.

## 1. `ongkir-py` implementation (TDD, in order)

Already done by 000, not repeated here: project setup, dependencies, `/health`, `spectest.py` harness, mise tasks. Work in `services/ongkir-py/`; run with `mise run test:ongkir` and `mise run lint:ongkir`.

1. [x] `tests/test_pricing.py` (red first): `billable_weight_kg` for 1 g, 1000 g, 1001 g, 50000 g, volumetric > actual, tie; zones; option ordering (R4, including price ties).
2. [x] `tests/test_validation.py` (red first): validation order and strict integer parsing from step 0.
3. [x] Register `specs/004-ongkir/cases.json` in `SPEC_FILES` in `tests/test_spec.py` (red first; the existing harness runs it).
4. [x] `app/data.py` — constants for cities (ordered) and tariffs + ETD per zone.
5. [x] `app/pricing.py` — pure functions: `zone()`, `billable_weight_kg()` (integer `ceil_div`, `max(1, …)`), `quote()` (sorted by price → courier → service).
6. [x] `app/main.py` — add to the existing app:
   - `GET /api/ongkir/cities` and `GET /api/ongkir`
   - query params as `str | None` + manual validation (the built-in 422 violates K2, as `AGENTS.md` of the service already says)
   - error messages exactly as in the spec table
   - city normalization trim + uppercase (R1/K3)
   - `application/json; charset=utf-8`, arrays never `null`
   - generic 500, detail only in the log
7. [x] Update the "Status" line in `services/ongkir-py/AGENTS.md` (it still says "only `/health`").

`/health` needs no new test: it is already covered by the 000 cases in `SPEC_FILES`.

## 2. `gateway-ts` (one new upstream, two routes)

Work in `services/gateway-ts/`; run with `mise run test:gateway` and `mise run lint:gateway`.

- [x] `src/app.ts`: `Upstream = "tracking" | "ongkir"`; two `ROUTES` rows, `/api/ongkir` and `/api/ongkir/cities` (matching is exact-path, so one prefix row is not enough).
- [x] `src/main.ts`: `ongkir: process.env.ONGKIR_URL ?? "http://localhost:8083"`.
- [x] Existing tests build `createApp` with only `tracking`. Add the `ongkir` key to `test/app.test.ts` (`startGateway`) and `test/spec.test.ts`, otherwise the types break.
- [x] Tests in `test/app.test.ts`, using the fake upstream (the service AGENTS.md says not to depend on live services):
  - `/api/ongkir?...` and `/api/ongkir/cities` are forwarded with path, query, status and body unchanged
  - ongkir upstream down → `502 {"error":"layanan ongkir tidak tersedia"}`
- [x] Update `services/gateway-ts/AGENTS.md`: `ONGKIR_URL` env, ongkir is proxied (it still lists it as planned).

## 3. `web/` — "Cek Ongkir" tab

Read `web/index.html` and `web/app.js` first to match how the current UI is structured, then:

- [x] `web/ongkir-format.js` — pure functions only, no DOM: `formatRupiah(22000)` → `Rp 22.000`, `formatEtd({min,max})` (`3–4 hari`, `1 hari` when min = max), `cheapestIndex(options)`. Loaded as a classic `<script>` like `app.js` (no build step); a `typeof module` guard exports the functions so `node:test` can load it.
- [x] `services/gateway-ts/test/ongkir-format.test.ts` — loads that file with `createRequire` and tests it (see "UI test" below). Written first (red).
- [x] Origin and destination dropdowns from `/api/ongkir/cities`.
- [x] Weight input (grams) + a collapsible block for optional dimensions.
- [x] Result table: Kurir | Layanan | Estimasi | Harga (via the pure functions above); first row labeled "Termurah".
- [x] Render with `textContent`/`createElement`, not `innerHTML` (root AGENTS.md rule for API data).
- [x] Show the server's `error` message (Indonesian).

**UI test (automated, logic only).** `ongkir-format.test.ts` covers `formatRupiah` (`0`, `7000` → `Rp 7.000`, `22000` → `Rp 22.000`, `1000000` → `Rp 1.000.000`), `formatEtd` (range and single value) and `cheapestIndex` (first of a tie). DOM rendering is not covered automatically.

**Manual check** with `mise run dev` at `http://localhost:8080`:
1. JKT → BDG, 1500 g → first row POS KILAT `Rp 22.000`, labeled "Termurah".
2. Fill dimensions SBY → MDN 1000 g 30×20×20 → billable 2 kg, prices match the spec case.
3. Empty or 0 weight → Indonesian error message shown, no table.
4. Stop `ongkir-py` → "layanan ongkir tidak tersedia" message.
5. Regression: switch to the resi tab; a dummy resi and a nonexistent resi still work.

## 4. Wrap-up

- [x] Root `AGENTS.md`: update the `ongkir-py` status cell (and the `gateway-ts` one) in the service table.
- [x] `specs/README.md` and the 004 spec header: Status → **Implemented**, only after every DoD below is met.
- [x] Not in this plan: CI (`.github/workflows`). It is still an open item of 000.

## Files touched

| File | Action | Reason |
|---|---|---|
| `specs/004-ongkir/spec.md`, `cases.json` | edit | step 0 clarifications |
| `specs/README.md` | edit | Status column |
| `services/ongkir-py/app/data.py`, `app/pricing.py`, `app/validation.py` | new | spec work; validation split out of `main.py` so it can be unit-tested |
| `services/ongkir-py/app/main.py` | edit | two endpoints, validation |
| `services/ongkir-py/tests/test_pricing.py`, `test_validation.py` | new | tests |
| `services/ongkir-py/tests/test_spec.py` | edit | add 004 to `SPEC_FILES` |
| `services/ongkir-py/AGENTS.md` | edit | status line |
| `services/gateway-ts/src/app.ts`, `src/main.ts` | edit | `ongkir` upstream + two routes + env |
| `services/gateway-ts/test/app.test.ts`, `test/spec.test.ts` | edit | add `ongkir` upstream, proxy + 502 tests |
| `services/gateway-ts/AGENTS.md` | edit | env + proxied path |
| `web/index.html`, `app.js`, `style.css` | edit | Cek Ongkir tab |
| `web/ongkir-format.js` | new | pure formatting logic, loaded by the page and by the test |
| `services/gateway-ts/test/ongkir-format.test.ts` | new | `node:test` for that logic (reads a file under `web/` the same way the existing tests read `web/`) |
| `AGENTS.md` (root) | edit | service status cells |

Not touched: `mise.toml` (tasks and `ONGKIR_URL` already exist), `tracking-go`, `detect-rust`, CI, the SQLite DB.

## DoD → test

Root DoD: `mise run lint` and `mise run test` green; spec/contract still accurate; manual UI check via `mise run dev`.

| Definition of done | Test |
|---|---|
| `cases.json` passes via `pytest` | `tests/test_spec.py` (17 cases + new step 0 cases) |
| `billable_weight_kg` boundaries (1 g, 1000 g, 1001 g, 50000 g, volumetric > actual) | `tests/test_pricing.py` |
| Validation order and strict integer parsing | `tests/test_validation.py` |
| `/health` per A3 | already covered by the 000 cases in `SPEC_FILES` |
| Gateway proxies `/api/ongkir*` | `gateway-ts` proxy test with a fake upstream (path, query, status, body unchanged) |
| Gateway returns 502 when the service is down | `gateway-ts` 502 test |
| Spec acceptance "cases can also run via the gateway" | **manual**: with `mise run dev`, run a few 004 requests through `:8080` and compare. No `cases.e2e.json` exists for 004, and the gateway tests must not depend on live services |
| Price/ETD formatting and "Termurah" pick | `services/gateway-ts/test/ongkir-format.test.ts` |
| Cek Ongkir tab renders and works, resi tracking not broken | **manual** (scenarios 1–5 in step 3); DOM rendering has no automated test |
| `mise run lint` and `mise run test` green | those commands |

## Risky changes

| Change | Risk | Reason | Mitigation |
|---|---|---|---|
| Edit `spec.md` / `cases.json` | contract changes | Python `int()` is lenient; error order is ambiguous | step 0 approved by the user first; status not changed by the agent |
| Manual validation instead of FastAPI's | more code | built-in 422 violates K2 | `test_validation.py` + spec cases |
| `Upstream` type gains `ongkir` | existing gateway tests stop compiling | `Config.upstreams` is keyed by `Upstream` | update the two existing test files in the same change |
| New gateway routes | wrong routing | required by the spec | proxy test + 502 test; exact-path rows copy the existing pattern |
| Edit existing `web/` | resi tracking could break | new tab lives in the same UI | manual regression scenario 5 |
| Pure JS module shared by the page and a Node test | the `typeof module` guard is a small pattern the repo doesn't use yet; `tsc`/`biome` may complain about the test's untyped `require` | user chose an automated test over manual-only for the UI logic | keep the guard to one line, no new dependency, no build step; check `mise run lint:gateway` passes |
| Edit root and service `AGENTS.md` | docs drift | they currently say "skeleton"/"planned" | only the status lines change |

## Other risks and notes

- **Test location.** The UI test lives in `gateway-ts` only because it is the one place with a JS test runner; it reads `web/` the same way the existing static-file tests do. It does not import any service code (A2).
- **FastAPI 422**: typed query params would produce the wrong error shape. Use `str | None` + manual validation.
- **Tariff data** stays as constants in code; it does not read the tracking DB (A2, A6).
- **No CI** exists yet, so "green" means `mise run lint` and `mise run test` locally.

## Implementation notes

What differs from the plan as written, and why.

- **`app/validation.py` added.** Validation (R1, R6–R8) lives in its own module instead of `main.py`, so `test_validation.py` can test it without HTTP. Routing stays in `main.py`.
- **Spec 004 changes (step 0):** added R6 (empty = not given), R7 (strict `^[0-9]+$`, no trim) and R8 (validation order), plus 13 cases (30 total).
- **`courierName()` fallback in `web/app.js`.** Found while testing in a real browser with tracking down: `/api/couriers` returned an error object and `couriers.find` threw, leaving the ongkir table empty. The tab now falls back to the upper-cased courier code, so it no longer depends on tracking being up.
- **Verification environment.** `mise` and `uv` were not installed. I ran the same commands directly: `uv sync --locked` + `uv run pytest` + `uv run ruff check/format --check` (uv 0.13.8, Python 3.12), and `npm test` + `biome check` + `tsc` (Node 24.22.3). The browser scenarios ran against a fake tracking server (`tracking-go` could not be built: its modules are not cached and the disk is nearly full).
- **Pre-existing lint failure.** `biome check` reports one formatting error in `services/gateway-ts/AGENTS.md` (`*erasable*` → `_erasable_`) on a line this change did not touch.

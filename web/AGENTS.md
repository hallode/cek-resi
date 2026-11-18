# AGENTS.md — web/

Frontend statis satu halaman (spec 000 F1–F7, desain spec 005). HTML/CSS/vanilla JS, ES modules, **tanpa framework dan build step**. Diserve gateway; hanya memanggil path publik `/api/*`.

| File | Isi |
|---|---|
| `index.html` | kerangka halaman, tab, markup tiap tab |
| `app.js` | entry: `init()` tiap tab + `startRouter({...})` |
| `js/router.js` | hash route `#/<tab>?query`, `replaceParams`, `navigate` |
| `js/ui.js` | helper bersama: `h()`, `icon()`, `announce()`, `copyButton()`, format waktu WIB |
| `js/resi.js` · `js/bulk.js` · `js/ongkir.js` | satu modul per tab |
| `css/tokens.css` · `base.css` · `components.css` | token (terang/gelap), dasar, komponen |

- Mengubah satu tab: baca modul tab itu + `ui.js` bila perlu helper; tab lain tidak perlu dibaca.
- Render data API dengan `textContent`/`h()`, **jangan `innerHTML`**. Komponen memakai token CSS, bukan nilai mentah.
- Logika bisnis ada di backend; JS hanya fetch + render + state UI.
- Test: gateway memastikan semua aset tersaji (`services/gateway-ts/test/app.test.ts`). Tampilan tetap dicek manual di browser (`mise run dev`).

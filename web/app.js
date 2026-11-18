// Entry point: wires the tab modules to the router. Each tab lives in js/<tab>.js (spec 000, F3).
import * as ongkir from "./js/ongkir.js";
import * as resi from "./js/resi.js";
import { startRouter } from "./js/router.js";

resi.init();
ongkir.init();

// Tabs without a module yet show a "Segera hadir" placeholder (F5); add their handler here.
startRouter({ resi: resi.enter, ongkir: ongkir.enter });

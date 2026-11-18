import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8080);

const app = createApp({
  webDir: process.env.WEB_DIR ?? fileURLToPath(new URL("../../../web/", import.meta.url)),
  upstreams: {
    tracking: process.env.TRACKING_URL ?? "http://localhost:8081",
    detect: process.env.DETECT_URL ?? "http://localhost:8082",
    ongkir: process.env.ONGKIR_URL ?? "http://localhost:8083",
  },
});

app.listen(port, () => {
  console.log(`gateway-ts listening on http://localhost:${port}`);
});

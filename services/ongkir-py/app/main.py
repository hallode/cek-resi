"""ongkir-py: shipping cost calculator (spec 004). For now only /health (spec 000)."""

from fastapi import FastAPI

SERVICE = "ongkir-py"

app = FastAPI(title=SERVICE)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE}

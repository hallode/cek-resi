"""ongkir-py: dummy shipping cost calculator (spec 004)."""

import logging
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .data import CITIES, CITY_BY_CODE
from .pricing import billable_weight_kg, quote, zone
from .validation import RequestError, parse_request

SERVICE = "ongkir-py"

log = logging.getLogger(SERVICE)
app = FastAPI(title=SERVICE)


def _json(status: int, body: Any) -> JSONResponse:
    # K1: application/json; charset=utf-8
    return JSONResponse(body, status_code=status, media_type="application/json; charset=utf-8")


@app.exception_handler(Exception)
async def unexpected(_request: Any, exc: Exception) -> JSONResponse:
    # K2: generic message for the client, detail only in the log.
    log.error("internal error", exc_info=exc)
    return _json(500, {"error": "terjadi kesalahan pada server"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE}


@app.get("/api/ongkir/cities")
def cities() -> JSONResponse:
    return _json(200, [{"code": c, "name": n, "island": i} for c, n, i in CITIES])


@app.get("/api/ongkir")
def ongkir(
    origin: str | None = None,
    destination: str | None = None,
    weight: str | None = None,
    length: str | None = None,
    width: str | None = None,
    height: str | None = None,
) -> JSONResponse:
    try:
        req = parse_request(origin, destination, weight, length, width, height)
    except RequestError as err:
        return _json(400, {"error": str(err)})

    billable = billable_weight_kg(req.weight_g, req.dims)
    return _json(
        200,
        {
            "origin": {"code": req.origin, "name": CITY_BY_CODE[req.origin][0]},
            "destination": {"code": req.destination, "name": CITY_BY_CODE[req.destination][0]},
            "zone": zone(req.origin, req.destination),
            "billable_weight_kg": billable,
            "options": quote(req.origin, req.destination, billable),
        },
    )

"""Pure pricing functions for spec 004 (R2-R5). No I/O, no HTTP."""

from typing import Any

from .data import CITY_BY_CODE, TARIFFS

Dims = tuple[int, int, int]


def zone(origin: str, destination: str) -> str:
    if origin == destination:
        return "DALAM_KOTA"
    if CITY_BY_CODE[origin][1] == CITY_BY_CODE[destination][1]:
        return "SATU_PULAU"
    return "ANTAR_PULAU"


def billable_weight_kg(weight_g: int, dims: Dims | None = None) -> int:
    """R2: integer arithmetic only, so every language gets the same answer."""
    units = weight_g * 6  # 1/6000 kg
    if dims is not None:
        length, width, height = dims
        units = max(units, length * width * height)
    return max(1, -(-units // 6000))  # ceil_div


def quote(origin: str, destination: str, billable_kg: int) -> list[dict[str, Any]]:
    """R3-R5: every service is available in every zone, sorted by R4."""
    z = zone(origin, destination)
    options = [
        {
            "courier": courier,
            "service": service,
            "price": rates[z] * billable_kg,
            "etd_days": {"min": etds[z][0], "max": etds[z][1]},
        }
        for courier, service, rates, etds in TARIFFS
    ]
    options.sort(key=lambda o: (o["price"], o["courier"], o["service"]))
    return options

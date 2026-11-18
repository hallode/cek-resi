"""Manual query validation for spec 004 (R1, R6-R8).

FastAPI's own validation answers 422 in a different shape than K2, so query
params arrive as `str | None` and are checked here, in the spec's order.
"""

import re
from dataclasses import dataclass

from .data import CITY_BY_CODE

_DIGITS = re.compile(r"[0-9]+", re.ASCII)

MSG_MISSING = "parameter origin, destination, dan weight wajib diisi"
MSG_ORIGIN = "kota asal tidak dikenal"
MSG_DESTINATION = "kota tujuan tidak dikenal"
MSG_WEIGHT = "weight harus bilangan bulat 1-50000 gram"
MSG_PARTIAL = "length, width, height harus diisi semua atau tidak sama sekali"
MSG_DIMENSION = "dimensi harus bilangan bulat 1-200 cm"


class RequestError(Exception):
    """A client mistake; `str(err)` is the Indonesian message for the 400 body."""


@dataclass(frozen=True)
class Request:
    origin: str
    destination: str
    weight_g: int
    dims: tuple[int, int, int] | None


def _strict_int(raw: str, low: int, high: int) -> int | None:
    # fullmatch on the raw value: no trim, no sign, no underscores (R7).
    if not _DIGITS.fullmatch(raw):
        return None
    value = int(raw)
    return value if low <= value <= high else None


def parse_request(
    origin: str | None,
    destination: str | None,
    weight: str | None,
    length: str | None,
    width: str | None,
    height: str | None,
) -> Request:
    # R6: absent and empty are the same thing.
    if not origin or not destination or not weight:
        raise RequestError(MSG_MISSING)

    origin_code = origin.strip().upper()  # R1
    destination_code = destination.strip().upper()
    if origin_code not in CITY_BY_CODE:
        raise RequestError(MSG_ORIGIN)
    if destination_code not in CITY_BY_CODE:
        raise RequestError(MSG_DESTINATION)

    weight_g = _strict_int(weight, 1, 50000)
    if weight_g is None:
        raise RequestError(MSG_WEIGHT)

    given = [v for v in (length, width, height) if v]
    if not given:
        return Request(origin_code, destination_code, weight_g, None)
    if len(given) != 3:
        raise RequestError(MSG_PARTIAL)
    dims = [_strict_int(v, 1, 200) for v in given]
    if any(d is None for d in dims):
        raise RequestError(MSG_DIMENSION)
    return Request(origin_code, destination_code, weight_g, (dims[0], dims[1], dims[2]))

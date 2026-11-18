//! detect-rust: guesses the courier from an AWB number (spec 002).

pub mod patterns;

use std::collections::HashMap;

use axum::{
    Router,
    extract::Query,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::json;

pub const SERVICE: &str = "detect-rust";
const MAX_AWB_LEN: usize = 40;

/// Builds the HTTP router. Kept separate from `main` so tests can call it in-process.
pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/detect", get(detect))
        .fallback(|| async { error(StatusCode::NOT_FOUND, "endpoint tidak ditemukan") })
}

async fn health() -> Response {
    send_json(
        StatusCode::OK,
        &json!({ "status": "ok", "service": SERVICE }),
    )
}

#[derive(Serialize)]
struct CandidateJson {
    code: &'static str,
    confidence: &'static str,
}

#[derive(Serialize)]
struct DetectJson {
    awb: String,
    candidates: Vec<CandidateJson>,
}

async fn detect(Query(q): Query<HashMap<String, String>>) -> Response {
    // R1: trim + uppercase before matching.
    let awb = q
        .get("awb")
        .map(|s| s.trim().to_uppercase())
        .unwrap_or_default();
    if awb.is_empty() {
        return error(StatusCode::BAD_REQUEST, "parameter awb wajib diisi");
    }
    if awb.chars().count() > MAX_AWB_LEN {
        return error(StatusCode::BAD_REQUEST, "awb terlalu panjang");
    }

    let candidates = patterns::detect(&awb)
        .into_iter()
        .map(|c| CandidateJson {
            code: c.code,
            confidence: c.confidence.as_str(),
        })
        .collect();
    send_json(StatusCode::OK, &DetectJson { awb, candidates })
}

/// JSON response with the charset required by spec 000 (K1).
fn send_json<T: Serialize>(status: StatusCode, body: &T) -> Response {
    match serde_json::to_vec(body) {
        Ok(bytes) => (
            status,
            [(header::CONTENT_TYPE, "application/json; charset=utf-8")],
            bytes,
        )
            .into_response(),
        Err(err) => {
            eprintln!("encode json: {err}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

fn error(status: StatusCode, msg: &str) -> Response {
    send_json(status, &json!({ "error": msg }))
}

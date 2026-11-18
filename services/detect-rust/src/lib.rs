//! detect-rust: guesses the courier from an AWB number (spec 002).
//! For now only `/health` (spec 000); `/api/detect` lands with spec 002.

use axum::{Json, Router, routing::get};
use serde_json::{Value, json};

pub const SERVICE: &str = "detect-rust";

/// Builds the HTTP router. Kept separate from `main` so tests can call it in-process.
pub fn app() -> Router {
    Router::new().route("/health", get(health))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": SERVICE }))
}

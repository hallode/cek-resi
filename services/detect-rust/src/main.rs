#[tokio::main]
async fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8082".into());
    let addr = format!("0.0.0.0:{port}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|err| panic!("bind {addr}: {err}"));
    println!("{} listening on {addr}", detect_rust::SERVICE);

    axum::serve(listener, detect_rust::app())
        .await
        .expect("server error");
}

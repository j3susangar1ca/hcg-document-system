use axum::{
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub async fn auth_middleware<B>(req: Request<B>, next: Next<B>) -> Result<Response, StatusCode> {
    let auth_header = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));

    match auth_header {
        Some(token) => {
            // Validación del secreto local del Leader
            let secret = "TU_CLAVE_SECRETA_LOCAL"; 
            let validation = Validation::default();
            decode::<Claims>(token, &DecodingKey::from_secret(secret.as_ref()), &validation)
                .map_err(|_| StatusCode::UNAUTHORIZED)?;
            
            Ok(next.run(req).await)
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

pub async fn login_handler() -> &'static str {
    "Login Placeholder"
}

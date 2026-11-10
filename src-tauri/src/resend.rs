//! Thin, secure wrapper around the Resend HTTP API.
//!
//! All requests are made from Rust so the API key never enters the webview.
//! The key is fetched from the OS keychain on every call. Rate-limit (429) and
//! quota errors are translated into friendly, actionable messages.

use reqwest::{Client, Method, StatusCode};
use serde::Deserialize;
use serde_json::{json, Value};

const BASE_URL: &str = "https://api.resend.com";

fn client() -> Client {
    Client::new()
}

/// Perform a request against the Resend API using an explicit key.
pub(crate) async fn request_with_key(
    key: &str,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{BASE_URL}{path}");
    let is_read = method == Method::GET;
    let mut req = client().request(method, &url).bearer_auth(key);
    if is_read {
        // A stalled status read must not keep the frontend's refresh guard locked.
        req = req.timeout(std::time::Duration::from_secs(20));
    }
    if let Some(b) = body {
        req = req.json(&b);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error contacting Resend: {e}"))?;

    let status = resp.status();

    if status == StatusCode::TOO_MANY_REQUESTS {
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let name = body.get("name").and_then(Value::as_str).unwrap_or("");
        let message = body
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Rate limit exceeded");
        let friendly = match name {
            "daily_quota_exceeded" => "You've reached your daily sending quota (100/day on the free plan). Wait 24 hours or upgrade your Resend plan.".to_string(),
            "monthly_quota_exceeded" => "You've reached your monthly sending quota. Upgrade your Resend plan to send more.".to_string(),
            _ => match retry_after {
                Some(s) => format!("Resend rate limit hit. Try again in {s}s."),
                None => format!("Resend rate limit hit: {message}"),
            },
        };
        return Err(friendly);
    }

    if !status.is_success() {
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = body
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| body.get("error").and_then(Value::as_str))
            .unwrap_or("Request failed");
        return Err(format!("Resend error ({}): {message}", status.as_u16()));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read Resend response: {e}"))?;
    if text.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| format!("Failed to parse Resend response: {e}"))
}

/// Perform a request using the key stored in the keychain.
async fn request(method: Method, path: &str, body: Option<Value>) -> Result<Value, String> {
    let key = crate::keychain::require_api_key()?;
    request_with_key(&key, method, path, body).await
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

/// Validate the given key against Resend, then store it in the keychain.
/// Validation uses `GET /emails` which requires a Full-access key — the same
/// permission the read/poll features need.
#[tauri::command]
pub async fn save_api_key(
    key: String,
    poller: tauri::State<'_, crate::poller::Poller>,
) -> Result<(), String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("API key cannot be empty.".into());
    }
    // Probe the key so we fail fast on an invalid or sending-only key.
    request_with_key(&key, Method::GET, "/emails?limit=1", None)
        .await
        .map_err(|e| {
            if e.contains("(401)") || e.contains("(403)") {
                "This API key was rejected. Make sure it's a valid Resend key with Full access."
                    .to_string()
            } else {
                e
            }
        })?;
    crate::keychain::set_api_key(&key)?;
    crate::poller::invalidate(&poller);
    Ok(())
}

/// Whether an API key is currently stored.
#[tauri::command]
pub async fn has_api_key() -> Result<bool, String> {
    Ok(crate::keychain::get_api_key()?.is_some())
}

/// Return the stored API key so the user can view it (Settings "reveal").
#[tauri::command]
pub async fn reveal_api_key() -> Result<Option<String>, String> {
    crate::keychain::get_api_key()
}

/// Remove the stored API key.
#[tauri::command]
pub async fn delete_api_key(poller: tauri::State<'_, crate::poller::Poller>) -> Result<(), String> {
    crate::keychain::delete_api_key()?;
    crate::poller::invalidate(&poller);
    Ok(())
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct SendEmailInput {
    #[serde(default)]
    pub headers: Option<std::collections::BTreeMap<String, String>>,
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub cc: Option<Vec<String>>,
    #[serde(default)]
    pub bcc: Option<Vec<String>>,
    #[serde(default)]
    pub reply_to: Option<Vec<String>>,
}

#[tauri::command]
pub async fn send_email(input: SendEmailInput) -> Result<Value, String> {
    let body = send_body(input)?;
    request(Method::POST, "/emails", Some(body)).await
}

fn send_body(input: SendEmailInput) -> Result<Value, String> {
    if input.to.is_empty() {
        return Err("At least one recipient is required.".into());
    }
    if input.html.as_deref().unwrap_or("").trim().is_empty()
        && input.text.as_deref().unwrap_or("").trim().is_empty()
    {
        return Err("The email needs a body (text or HTML).".into());
    }

    let mut body = json!({
        "from": input.from,
        "to": input.to,
        "subject": input.subject,
    });
    if let Some(v) = input.html {
        body["html"] = Value::String(v);
    }
    if let Some(v) = input.text {
        body["text"] = Value::String(v);
    }
    if let Some(v) = input.cc.filter(|v| !v.is_empty()) {
        body["cc"] = json!(v);
    }
    if let Some(v) = input.bcc.filter(|v| !v.is_empty()) {
        body["bcc"] = json!(v);
    }
    if let Some(v) = input.reply_to.filter(|v| !v.is_empty()) {
        body["reply_to"] = json!(v);
    }

    if let Some(headers) = input.headers.filter(|headers| !headers.is_empty()) {
        for (name, value) in &headers {
            if reqwest::header::HeaderName::from_bytes(name.as_bytes()).is_err()
                || reqwest::header::HeaderValue::from_str(value).is_err()
            {
                return Err("Invalid email header.".into());
            }
        }
        body["headers"] = json!(headers);
    }
    Ok(body)
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/// List received (inbound) emails, newest first. `after` supports pagination.
#[tauri::command]
pub async fn list_received(
    limit: Option<u32>,
    after: Option<String>,
    before: Option<String>,
) -> Result<Value, String> {
    let limit = limit.unwrap_or(50).clamp(1, 100);
    let mut path = format!("/emails/receiving?limit={limit}");
    if let Some(a) = after {
        path.push_str(&format!("&after={a}"));
    }
    if let Some(b) = before {
        path.push_str(&format!("&before={b}"));
    }
    request(Method::GET, &path, None).await
}

/// Retrieve a single received email including its html/text body.
#[tauri::command]
pub async fn get_received(id: String) -> Result<Value, String> {
    request(Method::GET, &format!("/emails/receiving/{id}"), None).await
}

/// List sent emails, newest first.
#[tauri::command]
pub async fn list_sent(limit: Option<u32>) -> Result<Value, String> {
    let limit = limit.unwrap_or(50).clamp(1, 100);
    request(Method::GET, &format!("/emails?limit={limit}"), None).await
}

/// Retrieve a single sent email including its html/text body and delivery status.
#[tauri::command]
pub async fn get_sent(id: String) -> Result<Value, String> {
    request(Method::GET, &format!("/emails/{id}"), None).await
}

/// List domains accessible to the configured key, one page at a time.
#[tauri::command]
pub async fn list_domains(after: Option<String>) -> Result<Value, String> {
    let mut url =
        reqwest::Url::parse(&format!("{BASE_URL}/domains?limit=100")).map_err(|e| e.to_string())?;
    if let Some(cursor) = after {
        url.query_pairs_mut().append_pair("after", &cursor);
    }
    let path = format!("{}?{}", url.path(), url.query().unwrap_or_default());
    request(Method::GET, &path, None).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> SendEmailInput {
        serde_json::from_value(json!({
            "from": "me@example.com", "to": ["person@example.com"],
            "subject": "Re: Greeting", "text": "Hello",
            "headers": { "In-Reply-To": "<parent@example.com>", "References": "<root@example.com> <parent@example.com>" }
        })).unwrap()
    }

    #[test]
    fn forwards_threading_headers_without_changing_body() {
        let body = send_body(input()).unwrap();
        assert_eq!(body["headers"]["In-Reply-To"], "<parent@example.com>");
        assert_eq!(
            body["headers"]["References"],
            "<root@example.com> <parent@example.com>"
        );
        assert_eq!(body["text"], "Hello");
    }

    #[test]
    fn rejects_header_injection_before_network_request() {
        let mut value = input();
        value.headers = Some(std::collections::BTreeMap::from([(
            "In-Reply-To".into(),
            "<a@example.com>\r\nBcc: victim@example.com".into(),
        )]));
        assert!(send_body(value).is_err());
    }

    #[test]
    fn new_messages_do_not_require_thread_headers() {
        let mut value = input();
        value.headers = None;
        assert!(send_body(value).unwrap().get("headers").is_none());
    }
}

//! Background inbox poller.
//!
//! Runs on a tokio interval independent of the webview. Because backgrounded /
//! minimized / occluded webviews throttle JS timers, doing this in Rust ensures
//! new-mail notifications fire on time regardless of window state. New mail is
//! detected here, a system notification is shown from Rust, and the inbox list
//! is pushed to the UI via a Tauri event.

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use reqwest::Method;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Notify;

const MIN_INTERVAL: u64 = 30;

#[derive(Default)]
pub struct PollerInner {
    /// Bumped to invalidate the running loop (stop / restart).
    generation: AtomicU64,
    interval_secs: AtomicU64,
    /// Whether the first (seeding) poll has completed. Emails present on the
    /// first poll are not treated as "new" and don't notify.
    seeded: AtomicBool,
    known: Mutex<HashSet<String>>,
    /// Wake the loop to poll immediately (manual refresh).
    poll_now: Notify,
    /// Wake the loop to re-arm its timer (interval changed).
    reschedule: Notify,
}

#[derive(Default)]
pub struct Poller(pub Arc<PollerInner>);

/// "Name <email@x>" -> "Name"; otherwise the bare address.
fn display_from(input: &str) -> String {
    if let Some(open) = input.find('<') {
        let name = input[..open].trim().trim_matches('"').trim();
        if !name.is_empty() {
            return name.to_string();
        }
        let rest = &input[open + 1..];
        if let Some(close) = rest.find('>') {
            return rest[..close].trim().to_string();
        }
    }
    input.trim().to_string()
}

async fn do_poll(app: &AppHandle, inner: &Arc<PollerInner>) {
    let key = match crate::keychain::get_api_key() {
        Ok(Some(k)) if !k.is_empty() => k,
        _ => return,
    };

    let value = match crate::resend::request_with_key(
        &key,
        Method::GET,
        "/emails/receiving?limit=50",
        None,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            let _ = app.emit("inbox-error", e);
            return;
        }
    };

    let items = value
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let seeded = inner.seeded.load(Ordering::Relaxed);
    let mut fresh: Vec<Value> = Vec::new();
    let mut fresh_ids: Vec<String> = Vec::new();
    {
        let mut known = inner.known.lock().unwrap();
        for item in &items {
            if let Some(id) = item.get("id").and_then(Value::as_str) {
                // insert() returns true if the id was not already present.
                if known.insert(id.to_string()) && seeded {
                    fresh.push(item.clone());
                    fresh_ids.push(id.to_string());
                }
            }
        }
    }
    inner.seeded.store(true, Ordering::Relaxed);

    if !fresh.is_empty() {
        notify_new(app, &fresh);
    }

    let _ = app.emit("inbox-data", json!({ "emails": items, "newIds": fresh_ids }));
}

fn notify_new(app: &AppHandle, fresh: &[Value]) {
    let subject = |e: &Value| -> String {
        e.get("subject")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .unwrap_or("(no subject)")
            .to_string()
    };

    let (title, body) = if fresh.len() == 1 {
        let from = fresh[0].get("from").and_then(Value::as_str).unwrap_or("");
        (
            format!("New email from {}", display_from(from)),
            subject(&fresh[0]),
        )
    } else {
        let subjects: Vec<String> = fresh.iter().take(3).map(subject).collect();
        (format!("{} new emails", fresh.len()), subjects.join(" · "))
    };

    let _ = app.notification().builder().title(title).body(body).show();
}

fn spawn_loop(app: AppHandle, inner: Arc<PollerInner>, generation: u64) {
    tauri::async_runtime::spawn(async move {
        loop {
            if inner.generation.load(Ordering::SeqCst) != generation {
                break;
            }
            do_poll(&app, &inner).await;
            if inner.generation.load(Ordering::SeqCst) != generation {
                break;
            }
            let secs = inner.interval_secs.load(Ordering::Relaxed).max(MIN_INTERVAL);
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(secs)) => {}
                _ = inner.poll_now.notified() => {}
                _ = inner.reschedule.notified() => {}
            }
        }
    });
}

/// (Re)start the poller. Seeds fresh so existing mail isn't announced as new.
#[tauri::command]
pub fn start_poller(app: AppHandle, state: State<Poller>, interval_secs: u64) {
    let inner = state.0.clone();
    inner
        .interval_secs
        .store(interval_secs.max(MIN_INTERVAL), Ordering::Relaxed);
    inner.seeded.store(false, Ordering::Relaxed);
    inner.known.lock().unwrap().clear();
    let generation = inner.generation.fetch_add(1, Ordering::SeqCst) + 1;
    spawn_loop(app, inner, generation);
}

/// Stop the poller (e.g. on disconnect). The loop exits at its next checkpoint.
#[tauri::command]
pub fn stop_poller(state: State<Poller>) {
    state.0.generation.fetch_add(1, Ordering::SeqCst);
}

/// Change the interval without restarting; re-arms the current cycle's timer.
#[tauri::command]
pub fn set_poll_interval(state: State<Poller>, interval_secs: u64) {
    state
        .0
        .interval_secs
        .store(interval_secs.max(MIN_INTERVAL), Ordering::Relaxed);
    state.0.reschedule.notify_one();
}

/// Trigger an immediate poll (manual refresh).
#[tauri::command]
pub fn poll_now(state: State<Poller>) {
    state.0.poll_now.notify_one();
}

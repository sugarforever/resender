mod keychain;
mod poller;
mod resend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(poller::Poller::default())
        .invoke_handler(tauri::generate_handler![
            resend::save_api_key,
            resend::has_api_key,
            resend::reveal_api_key,
            resend::delete_api_key,
            resend::send_email,
            resend::list_received,
            resend::get_received,
            resend::list_sent,
            resend::get_sent,
            poller::start_poller,
            poller::stop_poller,
            poller::set_poll_interval,
            poller::poll_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

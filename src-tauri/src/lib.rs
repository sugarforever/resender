mod keychain;
mod resend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

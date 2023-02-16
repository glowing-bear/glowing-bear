#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::default().build()) // register plugin to remember window state
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

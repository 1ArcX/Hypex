//! Hypex desktop: a native window around the live Netlify site.
//!
//! The app ships no copy of the frontend — it always loads SITE_URL, so every
//! Netlify deploy shows up here on the next start/reload. The only logic in
//! here makes browser-only behaviour (popups, external links) work in a
//! standalone window.

use std::sync::atomic::{AtomicUsize, Ordering};

use tauri::webview::NewWindowResponse;
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const SITE_URL: &str = "https://hypexdash.netlify.app";
const BG: tauri::window::Color = tauri::window::Color(0x0b, 0x0b, 0x0f, 0xff);

static POPUP_ID: AtomicUsize = AtomicUsize::new(0);

/// Popups that must stay inside the app because the site talks to them via
/// `window.opener` / `postMessage` (Google agenda koppelen, Simacan login) or
/// fills them in after opening (`window.open('')` for Magister books).
fn open_in_app(url: &Url) -> bool {
    if url.scheme() == "about" {
        return true;
    }
    let host = url.host_str().unwrap_or("");
    let site_host = Url::parse(SITE_URL).ok().and_then(|u| u.host_str().map(str::to_owned));
    if Some(host) == site_host.as_deref() || host == "localhost" {
        return true;
    }
    let path = url.path().to_ascii_lowercase();
    ["accounts.", "auth.", "login.", "sso."].iter().any(|p| host.starts_with(p))
        || path.contains("oauth")
        || path.contains("/auth")
        || path.contains("authorize")
}

fn build_main(app: &tauri::AppHandle) -> tauri::Result<()> {
    let handle = app.clone();
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(SITE_URL.parse().unwrap()))
        .title("Hypex")
        .inner_size(1280.0, 820.0)
        .min_inner_size(900.0, 620.0)
        .theme(Some(tauri::Theme::Dark))
        .background_color(BG)
        // Lets the site know it runs inside the app (hides the download button).
        .initialization_script("window.__HYPEX_DESKTOP__ = true;")
        .on_new_window(move |url, features| {
            if !open_in_app(&url) {
                let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                return NewWindowResponse::Deny;
            }
            let label = format!("popup-{}", POPUP_ID.fetch_add(1, Ordering::Relaxed));
            match WebviewWindowBuilder::new(&handle, label, WebviewUrl::External("about:blank".parse().unwrap()))
                .window_features(features)
                .title("Hypex")
                .background_color(BG)
                .on_document_title_changed(|w, title| {
                    let _ = w.set_title(&title);
                })
                .build()
            {
                Ok(window) => NewWindowResponse::Create { window },
                Err(_) => NewWindowResponse::Allow,
            }
        })
        .build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Opening Hypex a second time focuses the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_main(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Hypex");
}

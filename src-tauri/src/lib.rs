mod core;
mod errors;
mod models;

use core::SkillService;

#[tauri::command]
fn default_destination() -> Result<String, String> {
    Ok(core::path_to_forward_slashes(&SkillService::default_destination()))
}

#[tauri::command]
fn pick_destination() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .pick_folder()
        .map(|path| core::path_to_forward_slashes(&path)))
}

#[tauri::command]
async fn inspect_repository(
    repository_url: String,
    ref_value: Option<String>,
) -> Result<models::SkillInspectResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SkillService::new().map_err(|error| error.to_string())?;
        service
            .inspect_repository(&repository_url, ref_value.as_deref())
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn install_skills(
    repository_url: String,
    selected_paths: Vec<String>,
    destination: String,
    overwrite: bool,
    ref_value: Option<String>,
) -> Result<models::SkillInstallResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SkillService::new().map_err(|error| error.to_string())?;
        service
            .install_skills(
                &repository_url,
                &selected_paths,
                &destination,
                overwrite,
                ref_value.as_deref(),
            )
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            default_destination,
            pick_destination,
            inspect_repository,
            install_skills
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

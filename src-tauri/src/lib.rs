mod commands;
mod db;
mod models;

use commands::settings::MySqlState;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      let app_handle = app.handle().clone();

      // ── Step 1: SQLite — synchronous, completes in < 10 ms ─────────────
      // We use block_on here because SQLite is a local file operation.
      // This guarantees that sqlite_pool is managed before the event loop
      // starts, so Vue can safely call SQLite-backed commands immediately
      // after mount without any race condition.
      let sqlite_pool = tauri::async_runtime::block_on(async {
        let app_data_dir = app_handle
          .path()
          .app_data_dir()
          .expect("Failed to get app data dir");
        std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

        let db_path = app_data_dir.join("tb_clinic.db");
        let db_url = format!(
          "sqlite://{}?mode=rwc",
          db_path.to_str().expect("db path is not valid UTF-8")
        );

        let pool = SqlitePoolOptions::new()
          .max_connections(5)
          .connect(&db_url)
          .await
          .expect("Failed to connect to SQLite");

        sqlx::migrate!("./migrations")
          .run(&pool)
          .await
          .expect("Failed to run SQLite migrations");

        pool
      });

      // Register SQLite immediately so Vue commands work as soon as the
      // first frame renders.
      app_handle.manage(sqlite_pool.clone());

      // ── Step 2: MySQL — pre-register as None, connect asynchronously ───
      // MySQL auto-connect can take several seconds when the server is
      // behind Tailscale or temporarily unreachable.  We pre-register the
      // state as None so the event loop (and Vue) can start without waiting,
      // then fill it in once the connection is established.
      let mysql_state: MySqlState = Arc::new(Mutex::new(None));
      app_handle.manage(Arc::clone(&mysql_state));

      // Spawn the MySQL auto-connect attempt in the background.
      // The Vue app's checkConnection() / isConnected reactive state will
      // update naturally once the user navigates to a page that calls
      // get_mysql_status, or after the auto-connect completes and the
      // periodic alert refresh fires.
      tauri::async_runtime::spawn(async move {
        let connect_result =
          crate::commands::settings::load_config_from_sqlite(&sqlite_pool).await;

        let config = match connect_result {
          Ok(Some(c)) => c,
          Ok(None) => {
            // No saved config — normal first-run, nothing to do
            return;
          }
          Err(e) => {
            eprintln!("[sabot] Failed to load saved DB config: {e}");
            return;
          }
        };

        let url = format!(
          "mysql://{}:{}@{}:{}/{}",
          config.username, config.password, config.host, config.port, config.database
        );

        // Hard-cap the auto-connect attempt at 8 seconds so startup is
        // never indefinitely blocked when the server is unreachable.
        let pool_result = tokio::time::timeout(
          std::time::Duration::from_secs(8),
          MySqlPoolOptions::new()
            .max_connections(5)
            .connect(&url),
        )
        .await;

        match pool_result {
          Ok(Ok(pool)) => {
            println!(
              "[sabot] Auto-connected to MySQL ({}:{})",
              config.host, config.port
            );
            let mut guard = mysql_state.lock().await;
            *guard = Some(pool);
          }
          Ok(Err(e)) => {
            eprintln!("[sabot] Auto-connect to MySQL failed: {e}");
          }
          Err(_) => {
            eprintln!("[sabot] MySQL auto-connect timed out after 8 s");
          }
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::screening::search_tb_patients,
      commands::screening::get_dispensing_history,
      commands::patients::enroll_patient,
      commands::patients::get_active_patients,
      commands::patients::get_patient_detail,
      commands::patients::discharge_patient,
      commands::patients::get_discharged_patients,
      commands::followups::add_followup,
      commands::followups::update_treatment_phase,
      commands::alerts::get_patient_alerts,
      commands::settings::test_mysql_connection,
      commands::settings::connect_mysql,
      commands::settings::get_mysql_status,
      commands::settings::backup_sqlite,
      commands::settings::save_db_config,
      commands::settings::load_db_config,
      commands::settings::delete_db_config,
      commands::appointments::get_appointments,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
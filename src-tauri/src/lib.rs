mod commands;
mod db;
mod models;
mod settings;

use commands::settings::MySqlState;
use settings::SettingsManager;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let app_handle = app.handle().clone();

      // ── Step 1: SQLite — synchronous init ─────────────────────────────────
      let sqlite_pool = tauri::async_runtime::block_on(async {
        let app_data_dir = app_handle
          .path()
          .app_data_dir()
          .expect("Failed to get app data dir");
        std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

        let db_path = app_data_dir.join("tb_plus.db");
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

      app_handle.manage(sqlite_pool.clone());

      // ── Step 2: SettingsManager — wraps SqlitePool + master encryption key ─
      let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir for settings");
      let settings_manager = tauri::async_runtime::block_on(async {
        SettingsManager::new(sqlite_pool.clone(), &app_data_dir)
          .await
          .expect("Failed to initialize SettingsManager")
      });
      app_handle.manage(settings_manager);

      // ── Step 3: MySQL — pre-register as None, connect asynchronously ─────
      let mysql_state: MySqlState = Arc::new(Mutex::new(None));
      app_handle.manage(Arc::clone(&mysql_state));

      let app_handle_clone = app_handle.clone();

      tauri::async_runtime::spawn(async move {
        let settings = app_handle_clone.state::<SettingsManager>();
        let splash = settings.get_splash_messages().await.unwrap_or_default();

        let _ = app_handle_clone.emit("splash-status", &splash.loading_db);

        // Attempt auto-connect from saved config (using the registered
        // SettingsManager so the master encryption key is guaranteed to match).
        let connect_result = settings.get_db_config().await;

        match connect_result {
          Ok(Some(config)) => {
            let _ = app_handle_clone.emit("splash-status", &splash.connecting_mysql);

            let url = format!(
              "mysql://{}:{}@{}:{}/{}",
              config.username, config.password, config.host, config.port, config.database
            );

            let max_conn = settings
              .get_u32("mysql.max_connections", 5)
              .await
              .unwrap_or(5);
            let timeout_secs = settings
              .get_u64("mysql.connect_timeout_seconds", 8)
              .await
              .unwrap_or(8);

            let pool_result = tokio::time::timeout(
              std::time::Duration::from_secs(timeout_secs),
              MySqlPoolOptions::new()
                .max_connections(max_conn)
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
                let _ = app_handle_clone.emit("splash-status", &splash.connect_ok);
              }
              Ok(Err(e)) => {
                eprintln!("[sabot] Auto-connect to MySQL failed: {e}");
                let _ = app_handle_clone.emit("splash-status", &splash.connect_fail);
              }
              Err(_) => {
                eprintln!("[sabot] MySQL auto-connect timed out");
                let _ = app_handle_clone.emit("splash-status", &splash.connect_timeout);
              }
            }
          }
          Ok(None) => {
            let _ = app_handle_clone.emit("splash-status", &splash.no_config);
          }
          Err(e) => {
            eprintln!("[sabot] Failed to load saved DB config: {e}");
            let _ = app_handle_clone.emit("splash-status", &splash.config_load_fail);
          }
        }

        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
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
      commands::mapping::get_mapping_patients,
      commands::mapping::get_mapping_summary,
      commands::mapping::geocode_patient_address,
      commands::mapping::batch_geocode_patients,
      commands::alerts::get_patient_alerts,
      commands::settings::test_mysql_connection,
      commands::settings::connect_mysql,
      commands::settings::get_mysql_status,
      commands::settings::backup_sqlite,
      commands::settings::save_db_config,
      commands::settings::load_db_config,
      commands::settings::delete_db_config,
      commands::settings::search_hosxp_drugs,
      commands::settings::save_drug_classes,
      commands::settings::save_regimen_definitions,
      commands::settings::get_regimen_definitions,
      commands::settings::save_hosxp_config,
      commands::settings::load_hosxp_config,
      commands::settings::save_alert_config,
      commands::settings::load_alert_config,
      commands::settings::load_drug_classes,
      commands::settings::mark_setup_complete,
      commands::settings::is_setup_complete,
      commands::appointments::get_appointments,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

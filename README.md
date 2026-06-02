# TB Plus

[![Tauri](https://img.shields.io/badge/Tauri-%5E2-24c8db?logo=tauri&logoColor=fff)](https://tauri.app/)
[![Vue.js](https://img.shields.io/badge/Vue.js-%5E3.5-4FC08D?logo=vuedotjs&logoColor=fff)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-%5E6-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-%5E8-646CFF?logo=vite&logoColor=ffffff)](https://vitejs.dev/)
[![Pinia](https://img.shields.io/badge/Pinia-%5E3-FFE16B?logo=vue.js&logoColor=black)](https://pinia.vuejs.org/)
[![Vue_Router](https://img.shields.io/badge/Vue_Router-%5E5-4FC08D?logo=vuedotjs&logoColor=ffffff)](https://router.vuejs.org/)
[![Lucide](https://img.shields.io/badge/Lucide-%5E1-F92672?logo=lucide&logoColor=ffffff)](https://lucide.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern desktop application built with Tauri (Rust) and Vue (TypeScript) for managing tuberculosis (TB) clinic operations. This system bridges HOSxP's MySQL database (read-only) with a local SQLite database for clinic-specific tracking data.

## Features

- **Drug Screening**: Query HOSxP patients who have received TB drugs to identify new patients.
- **Active Patients Dashboard**: Overview of currently active TB patients with treatment progress and an alert engine tracking patient adherence.
- **Patient Details**: Full clinical timeline, drug dispensing history, monthly follow-up records, and side-effect tracking.
- **Weight-Based Dosage Management**: Automated calculation and clinical alerts for TB drug dosage adjustments based on real-time patient weight updates, ensuring optimal treatment efficacy and safety.
- **Epidemiological Mapping**: Interactive geographic map with disease distribution pinning to visualize patient locations, identify clustering, and support contact tracing or public health interventions.
- **Reports**: Summary statistics and exportable CSV reports for TB clinic audits (HA Standard).
- **Settings**: Complete control to configure database connections, update TB drug codes, and export local SQLite backups.

## Architecture

- **Frontend**: Vue 3.5 (Composition API, `<script setup>`), TypeScript 6, Pinia, Vue Router 5, and `lucide/vue` for iconography.
- **Backend / Desktop**: Tauri 2, Rust (stable), and `sqlx` driving database interactions.
- **Databases**:
  - **MySQL (HOSxP)**: Read-only access to query patient demographics and their drug dispensing records.
  - **SQLite**: Local, read-write database holding clinic metrics, treatment plans, follow-ups, and statuses.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 18+)
- [Rust](https://www.rust-lang.org/)
- Platform [Prerequisites for Tauri 2](https://v2.tauri.app/start/prerequisites/)

### Setup

1. **Clone the repository** (and switch into the project directory):

   ```bash
   git clone https://github.com/suradet-ps/tb-plus.git
   cd tb-plus
   ```

2. **Install frontend dependencies**:

   ```bash
   pnpm install
   ```

3. **Run the development server**:

   ```bash
   pnpm tauri dev
   ```

4. **Build for release** (generates OS specific execution binary):

   ```bash
   pnpm tauri build
   ```

## License

This project is licensed under the [MIT License](LICENSE).

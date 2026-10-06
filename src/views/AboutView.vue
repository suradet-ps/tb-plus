<script setup lang="ts">
import {
  CheckCircle,
  DatabaseZap,
  HardDrive,
  Info,
  Lock,
  Network,
  ShieldCheck,
  Stethoscope,
} from '@lucide/vue';

// Section 1: Feature list
const features = [
  'คัดกรองและลงทะเบียนผู้ป่วยจากระบบ HOSxP',
  'ติดตามความก้าวหน้าการรักษาและแจ้งเตือนอัตโนมัติ',
  'บันทึกผลติดตามรายเดือน น้ำหนัก ผลเสมหะ และอาการข้างเคียง',
] as const;

// Section 2: Security points
interface SecurityPoint {
  icon: object;
  title: string;
  desc: string;
}

const securityPoints: SecurityPoint[] = [
  {
    icon: Lock,
    title: 'อ่านอย่างเดียว (Read-Only)',
    desc: 'โปรแกรมเชื่อมต่อกับฐานข้อมูล HOSxP ในโหมดอ่านข้อมูลเท่านั้น ไม่สามารถเพิ่ม แก้ไข หรือลบข้อมูลใดๆ ในระบบ HOSxP ได้',
  },
  {
    icon: DatabaseZap,
    title: 'ไม่มีการเขียนข้อมูลกลับ (No Write-Back)',
    desc: 'ข้อมูลทั้งหมดที่บันทึกในโปรแกรมนี้ (การลงทะเบียน บันทึกติดตาม ผลการรักษา) จะถูกเก็บในฐานข้อมูลภายในเครื่อง (SQLite) ภายในเครื่องเท่านั้น ไม่ผ่านหรือเขียนกลับสู่ HOSxP',
  },
  {
    icon: Network,
    title: 'การเชื่อมต่อภายในเครือข่าย (Local Network Only)',
    desc: 'การเชื่อมต่อกับ HOSxP ทำผ่านเครือข่ายภายในโรงพยาบาลเท่านั้น ไม่มีการส่งข้อมูลออกสู่อินเทอร์เน็ต',
  },
];

// Section 4: Version / system info
interface InfoItem {
  label: string;
  value: string;
}

const infoItems: InfoItem[] = [
  { label: 'โปรแกรม', value: 'TB Plus' },
  { label: 'เวอร์ชัน', value: __APP_VERSION__ },
  { label: 'พัฒนาโดย', value: 'ทีมเภสัชกรรม โรงพยาบาลสระโบสถ์' },
  { label: 'แพลตฟอร์ม', value: 'Tauri 2.5 + Vue 3.5' },
  { label: 'ฐานข้อมูลภายในเครื่อง', value: 'SQLite' },
  { label: 'ฐานข้อมูล HIS', value: 'HOSxP MySQL (Read-Only)' },
];
</script>

<template>
  <div class="view-root">

    <!--Page header -->
    <div class="view-header">
      <h1>เกี่ยวกับโปรแกรม</h1>
      <p>TB Plus - โรงพยาบาลสระโบสถ์</p>
    </div>

    <div class="about-cards">

      <!-- Section 1 - โปรแกรมนี้คืออะไร-->
      <div class="about-card">

        <div class="card-header">
          <div class="card-icon-wrap card-icon-wrap--teal">
            <Stethoscope :size="20" stroke-width="2" />
          </div>
          <div class="card-header-text">
            <h2 class="card-title">โปรแกรมนี้คืออะไร</h2>
          </div>
        </div>

        <p class="card-body-text">
          โปรแกรมนี้พัฒนาขึ้นเพื่อช่วยบริหารจัดการคลินิกวัณโรค (TB Clinic) โรงพยาบาลสระโบสถ์
          โดยเฉพาะ ช่วยให้เภสัชกรสามารถติดตามผู้ป่วยวัณโรค วางแผนการรักษา
          บันทึกผลการตรวจติดตาม ได้อย่างมีประสิทธิภาพ
        </p>

        <ul class="feature-list">
          <li v-for="feat in features" :key="feat" class="feature-item">
            <CheckCircle :size="15" stroke-width="2.5" class="feature-check" />
            <span>{{ feat }}</span>
          </li>
        </ul>

      </div>

      <!-- Section 2 - ความปลอดภัยของฐานข้อมูล HOSxP -->
      <div class="about-card">

        <div class="card-header">
          <div class="card-icon-wrap card-icon-wrap--green">
            <ShieldCheck :size="20" stroke-width="2" />
          </div>
          <div class="card-header-text">
            <h2 class="card-title">ความปลอดภัยของฐานข้อมูล HOSxP</h2>
          </div>
        </div>

        <!-- Alt-bg callout banner -->
        <div class="security-banner">
          <ShieldCheck :size="18" stroke-width="2" class="banner-shield" />
          <span class="banner-text">ฐานข้อมูล HOSxP ปลอดภัย 100%</span>
          <span class="banner-badge">ยืนยัน</span>
        </div>

        <!-- 3 security points -->
        <div class="security-points">
          <div
            v-for="(point, idx) in securityPoints"
            :key="point.title"
            class="security-point"
            :class="{ 'security-point--last': idx === securityPoints.length - 1 }"
          >
            <div class="security-point-icon">
              <component :is="point.icon" :size="16" stroke-width="2" />
            </div>
            <div class="security-point-text">
              <p class="security-point-title">{{ point.title }}</p>
              <p class="security-point-desc">{{ point.desc }}</p>
            </div>
          </div>
        </div>

      </div>

      <!-- Section 3 - ฐานข้อมูลภายในเครื่อง -->
      <div class="about-card">

        <div class="card-header">
          <div class="card-icon-wrap card-icon-wrap--blue">
            <HardDrive :size="20" stroke-width="2" />
          </div>
          <div class="card-header-text">
            <h2 class="card-title">ฐานข้อมูลภายในเครื่อง</h2>
          </div>
        </div>

        <p class="card-body-text">
          ข้อมูลคลินิก TB ทั้งหมดที่บันทึกในโปรแกรม เก็บอยู่ในไฟล์ฐานข้อมูล SQLite
          ภายในเครื่องคอมพิวเตอร์ที่ติดตั้งโปรแกรม
        </p>

        <table class="data-table">
          <thead>
            <tr>
              <th class="data-th">แหล่งข้อมูล</th>
              <th class="data-th">วัตถุประสงค์</th>
              <th class="data-th data-th--right">สิทธิ์การเข้าถึง</th>
            </tr>
          </thead>
          <tbody>
            <tr class="data-row">
              <td class="data-td data-td--source">HOSxP MySQL</td>
              <td class="data-td">ข้อมูลผู้ป่วย ประวัติการจ่ายยา</td>
              <td class="data-td data-td--badge">
                <span class="access-badge access-badge--orange">Read Only</span>
              </td>
            </tr>
            <tr class="data-row data-row--last">
              <td class="data-td data-td--source">SQLite ภายในเครื่อง</td>
              <td class="data-td">การลงทะเบียน แผนการรักษา บันทึกติดตาม</td>
              <td class="data-td data-td--badge">
                <span class="access-badge access-badge--teal">Read/Write</span>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="backup-note">
          <Info :size="13" stroke-width="2" class="backup-note-icon" />
          แนะนำให้ทำการสำรองข้อมูล SQLite สม่ำเสมอผ่านหน้าตั้งค่า
        </p>

      </div>

      <!-- Section 4 - เวอร์ชันและข้อมูลระบบ -->
      <div class="about-card">

        <div class="card-header">
          <div class="card-icon-wrap card-icon-wrap--muted">
            <Info :size="20" stroke-width="2" />
          </div>
          <div class="card-header-text">
            <h2 class="card-title">เวอร์ชันและข้อมูลระบบ</h2>
          </div>
        </div>

        <div class="info-grid">
          <div v-for="item in infoItems" :key="item.label" class="info-row">
            <span class="info-label">{{ item.label }}</span>
            <span class="info-value">{{ item.value }}</span>
          </div>
        </div>

      </div>

    </div><!-- /.about-cards -->
  </div><!-- /.view-root -->
</template>

<style scoped>
/* Page root */
.view-root {
  padding: var(--page-root-padding);
  max-width: var(--page-max-lg);
}

/* Page header */
.view-header {
  margin-bottom: var(--space-14);
}

.view-header h1 {
  font-family: var(--font-family);
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-heading);
  color: var(--color-text);
  margin: 0 0 var(--space-2);
}

.view-header p {
  font-family: var(--font-family);
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  margin: 0;
}

/* Cards container */
.about-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

/* Individual card */
.about-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--card-padding);
}

/* Card header row */
.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-7);
  margin-bottom: var(--space-9);
}

/* Colored icon wrapper */
.card-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon-wrap--teal {
  background: rgba(42, 157, 153, 0.12);
  color: var(--color-teal);
}

.card-icon-wrap--green {
  background: rgba(26, 174, 57, 0.10);
  color: var(--color-green);
}

.card-icon-wrap--blue {
  background: rgba(0, 117, 222, 0.10);
  color: var(--color-blue);
}

.card-icon-wrap--muted {
  background: var(--btn-secondary-bg);
  color: var(--color-text-muted);
}

/* Vertically centre the title text inside the 40px icon row */
.card-header-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 40px;
}

.card-title {
  font-family: var(--font-family);
  font-size: var(--text-ui);
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-snug);
  color: var(--color-text);
  margin: 0;
}

/* Body paragraph */
.card-body-text {
  font-family: var(--font-family);
  font-size: var(--text-body);
  line-height: 1.65;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-9);
}

/* Feature list (Section 1) */
.feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin: 0;
  padding: 0;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  font-family: var(--font-family);
  font-size: 13.5px;
  font-weight: var(--weight-ui);
  color: var(--color-text);
  line-height: var(--leading-body);
}

.feature-check {
  flex-shrink: 0;
  color: var(--color-teal);
  margin-top: var(--space-1);
}

/* Security callout banner (Section 2) */
.security-banner {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  background: var(--color-surface-alt);
  border: var(--border-standard);
  border-radius: var(--radius-md);
  padding: var(--alert-padding);
  margin-bottom: var(--space-10);
}

.banner-shield {
  flex-shrink: 0;
  color: var(--color-green);
}

.banner-text {
  flex: 1;
  font-family: var(--font-family);
  font-size: 13.5px;
  font-weight: var(--weight-emphasis);
  letter-spacing: var(--tracking-snug);
  color: var(--color-text);
}

.banner-badge {
  flex-shrink: 0;
  padding: var(--badge-padding);
  border-radius: var(--radius-pill);
  background: rgba(26, 174, 57, 0.12);
  color: var(--color-green);
  font-family: var(--font-family);
  font-size: 11.5px;
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-badge);
}

/* Security points list (Section 2) */
.security-points {
  display: flex;
  flex-direction: column;
}

.security-point {
  display: flex;
  align-items: flex-start;
  gap: var(--space-7);
  padding: var(--space-7) 0;
  border-bottom: var(--border-standard);
}

.security-point:first-child {
  padding-top: 0;
}

.security-point--last {
  border-bottom: none;
  padding-bottom: 0;
}

.security-point-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--alert-success-bg);
  color: var(--color-green);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--space-1);
}

.security-point-text {
  flex: 1;
  min-width: 0;
}

.security-point-title {
  font-family: var(--font-family);
  font-size: 13.5px;
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  margin: 0 0 var(--space-2);
  line-height: var(--leading-normal);
}

.security-point-desc {
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--leading-relaxed);
}

/* Data table (Section 3) */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-7);
}

.data-th {
  font-family: var(--font-family);
  font-size: 11.5px;
  font-weight: var(--weight-emphasis);
  letter-spacing: var(--tracking-badge);
  color: var(--color-text-muted);
  text-transform: uppercase;
  text-align: left;
  padding: 0 var(--space-6) var(--space-5);
  border-bottom: var(--border-standard);
}

.data-th:first-child {
  padding-left: 0;
}

.data-th--right {
  text-align: right;
}

.data-row td {
  border-bottom: var(--border-standard);
}

.data-row--last td {
  border-bottom: none;
}

.data-td {
  font-family: var(--font-family);
  font-size: 13.5px;
  color: var(--color-text);
  padding: var(--space-6) var(--space-6);
  vertical-align: middle;
  line-height: var(--leading-normal);
}

.data-td:first-child {
  padding-left: 0;
}

.data-td--source {
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.data-td--badge {
  text-align: right;
  white-space: nowrap;
}

/* Access right badges */
.access-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-pill);
  font-family: var(--font-family);
  font-size: 11.5px;
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-badge);
  white-space: nowrap;
}

.access-badge--orange {
  background: rgba(221, 91, 0, 0.10);
  color: var(--color-orange);
}

.access-badge--teal {
  background: rgba(42, 157, 153, 0.10);
  color: var(--color-teal);
}

/* Backup hint note */
.backup-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  font-family: var(--font-family);
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--leading-body);
}

.backup-note-icon {
  flex-shrink: 0;
  margin-top: var(--space-1);
}

/* Info grid (Section 4) */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-6) 0;
  border-bottom: var(--border-standard);
}

/* Remove bottom border on the last two items (bottom row of 2-col grid) */
.info-row:nth-last-child(-n+2) {
  border-bottom: none;
}

/* Right-column items: separate with a left border + left padding */
.info-row:nth-child(even) {
  padding-left: var(--space-10);
  border-left: var(--border-standard);
}

.info-label {
  font-family: var(--font-family);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  letter-spacing: var(--tracking-badge);
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.info-value {
  font-family: var(--font-family);
  font-size: 13.5px;
  font-weight: var(--weight-ui);
  color: var(--color-text);
  line-height: var(--leading-normal);
}
</style>

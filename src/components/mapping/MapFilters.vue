<script setup lang="ts">
type FilterStatus = 'all' | 'active' | 'completed' | 'transferred' | 'died' | 'defaulted';
type FilterTbType = 'all' | 'pulmonary' | 'extra_pulmonary';
type FilterGeocode = 'all' | 'success' | 'pending' | 'failed' | 'missing_address';

const props = defineProps<{
  search: string;
  status: FilterStatus;
  tbType: FilterTbType;
  geocodeStatus: FilterGeocode;
  enrolledFrom: string;
  enrolledTo: string;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  'update:status': [value: FilterStatus];
  'update:tbType': [value: FilterTbType];
  'update:geocodeStatus': [value: FilterGeocode];
  'update:enrolledFrom': [value: string];
  'update:enrolledTo': [value: string];
  reset: [];
}>();
</script>

<template>
  <div class="filter-card">
    <div class="filter-row filter-row--search">
      <div class="filter-group filter-group--wide">
        <label for="mappingSearch">ค้นหาผู้ป่วยหรือพื้นที่</label>
        <input
          id="mappingSearch"
          :value="props.search"
          type="text"
          class="filter-input"
          placeholder="ค้นหาจากชื่อย่อ HN ย่อ หรือข้อความที่อยู่..."
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group">
        <label for="mappingStatus">สถานะผู้ป่วย</label>
        <select
          id="mappingStatus"
          class="filter-input"
          :value="props.status"
          @change="emit('update:status', ($event.target as HTMLSelectElement).value as FilterStatus)"
        >
          <option value="all">ทั้งหมด</option>
          <option value="active">กำลังรักษา</option>
          <option value="completed">รักษาหาย/ครบ</option>
          <option value="transferred">ส่งต่อ</option>
          <option value="died">เสียชีวิต</option>
          <option value="defaulted">ขาดการรักษา</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="mappingTbType">ชนิดวัณโรค</label>
        <select
          id="mappingTbType"
          class="filter-input"
          :value="props.tbType"
          @change="emit('update:tbType', ($event.target as HTMLSelectElement).value as FilterTbType)"
        >
          <option value="all">ทั้งหมด</option>
          <option value="pulmonary">Pulmonary</option>
          <option value="extra_pulmonary">Extra-pulmonary</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="mappingGeocode">สถานะพิกัด</label>
        <select
          id="mappingGeocode"
          class="filter-input"
          :value="props.geocodeStatus"
          @change="emit('update:geocodeStatus', ($event.target as HTMLSelectElement).value as FilterGeocode)"
        >
          <option value="all">ทั้งหมด</option>
          <option value="success">พร้อมแสดงบนแผนที่</option>
          <option value="pending">รอแปลงพิกัด</option>
          <option value="failed">แปลงพิกัดไม่สำเร็จ</option>
          <option value="missing_address">ไม่มีที่อยู่</option>
        </select>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group">
        <label for="mappingFrom">ลงทะเบียนตั้งแต่</label>
        <input
          id="mappingFrom"
          class="filter-input"
          type="date"
          :value="props.enrolledFrom"
          @input="emit('update:enrolledFrom', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="filter-group">
        <label for="mappingTo">ถึง</label>
        <input
          id="mappingTo"
          class="filter-input"
          type="date"
          :value="props.enrolledTo"
          @input="emit('update:enrolledTo', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="filter-actions">
        <button class="btn-reset" type="button" @click="emit('reset')">ล้างตัวกรอง</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.filter-row--search {
  grid-template-columns: minmax(0, 1fr);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group--wide {
  grid-column: 1 / -1;
}

.filter-group label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.125px;
  color: var(--color-text-secondary);
}

.filter-input {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #dddddd;
  background: #ffffff;
  color: var(--color-text);
  font-family: var(--font);
  font-size: 13px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-blue-focus);
  box-shadow: 0 0 0 3px rgba(9, 127, 232, 0.14);
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.btn-reset {
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: var(--border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.btn-reset:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

@media (max-width: 1100px) {
  .filter-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}
</style>

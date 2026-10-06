<script setup lang="ts">
type FilterStatus = 'all' | 'active' | 'completed' | 'transferred' | 'died' | 'defaulted';
type FilterTbType = 'all' | 'pulmonary' | 'extra_pulmonary';
type FilterGeocode = 'all' | 'success' | 'pending' | 'failed' | 'missing_address';
type FilterPhase = 'all' | 'intensive' | 'continuation';

const props = defineProps<{
  search: string;
  status: FilterStatus;
  tbType: FilterTbType;
  geocodeStatus: FilterGeocode;
  phase: FilterPhase;
  enrolledFrom: string;
  enrolledTo: string;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  'update:status': [value: FilterStatus];
  'update:tbType': [value: FilterTbType];
  'update:geocodeStatus': [value: FilterGeocode];
  'update:phase': [value: FilterPhase];
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
          class="form-input"
          placeholder="ค้นหาจากชื่อย่อ HN ย่อ หรือข้อความที่อยู่..."
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group">
        <label for="mappingStatus">สถานะผู้ป่วย</label>
        <div class="select-wrap">
          <select
            id="mappingStatus"
            class="form-select"
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
      </div>

      <div class="filter-group">
        <label for="mappingTbType">ชนิดวัณโรค</label>
        <div class="select-wrap">
          <select
            id="mappingTbType"
            class="form-select"
            :value="props.tbType"
            @change="emit('update:tbType', ($event.target as HTMLSelectElement).value as FilterTbType)"
        >
            <option value="all">ทั้งหมด</option>
            <option value="pulmonary">Pulmonary</option>
            <option value="extra_pulmonary">Extra-pulmonary</option>
          </select>
        </div>
      </div>

      <div class="filter-group">
        <label for="mappingGeocode">สถานะพิกัด</label>
        <div class="select-wrap">
          <select
            id="mappingGeocode"
            class="form-select"
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

      <div class="filter-group">
        <label for="mappingPhase">ระยะการรักษา</label>
        <div class="select-wrap">
          <select
            id="mappingPhase"
            class="form-select"
            :value="props.phase"
            @change="emit('update:phase', ($event.target as HTMLSelectElement).value as FilterPhase)"
        >
            <option value="all">ทั้งหมด</option>
            <option value="intensive">ระยะเข้มข้น</option>
            <option value="continuation">ระยะต่อเนื่อง</option>
          </select>
        </div>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group">
        <label for="mappingFrom">ลงทะเบียนตั้งแต่</label>
        <input
          id="mappingFrom"
          class="form-input"
          type="date"
          :value="props.enrolledFrom"
          @input="emit('update:enrolledFrom', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="filter-group">
        <label for="mappingTo">ถึง</label>
        <input
          id="mappingTo"
          class="form-input"
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
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

.filter-row--search {
  grid-template-columns: minmax(0, 1fr);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filter-group--wide {
  grid-column: 1 / -1;
}

.filter-group label {
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  letter-spacing: var(--tracking-badge);
  color: var(--color-text-secondary);
}


.filter-actions {
  display: flex;
  align-items: flex-end;
}

.btn-reset {
  min-height: 36px;
  padding: 0 var(--space-7);
  border-radius: var(--radius-sm);
  border: var(--border-standard);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  transition: var(--transition-bg), var(--transition-border), var(--transition-color);
}

.btn-reset:hover {
  background: var(--color-surface-alt);
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

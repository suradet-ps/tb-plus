<script setup lang="ts">
import L from 'leaflet';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import 'leaflet.markercluster';
import type { MappingPatientRow } from '@/types/mapping';

const props = defineProps<{
  patients: MappingPatientRow[];
  selectedHn: string | null;
}>();

const emit = defineEmits<{
  select: [hn: string];
  mapError: [message: string];
}>();

const mapElement = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markerLayer: L.MarkerClusterGroup | null = null;
let tileLayer: L.TileLayer | null = null;

function createIcon(color: string, isSelected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'tb-map-marker-shell',
    html: `<span class="tb-map-marker${isSelected ? ' tb-map-marker--selected' : ''}" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  });
}

function statusColor(patient: MappingPatientRow): string {
  switch (patient.tb_status) {
    case 'active':
      return '#dd5b00';
    case 'completed':
      return '#2a9d99';
    case 'defaulted':
      return '#615d59';
    case 'died':
      return '#31302e';
    case 'transferred':
      return '#0075de';
    default:
      return '#097fe8';
  }
}

function popupContent(patient: MappingPatientRow): string {
  return `
    <div class="tb-map-popup">
      <div class="tb-map-popup__title">${patient.masked_name}</div>
      <div class="tb-map-popup__meta">${patient.masked_hn}</div>
      <div class="tb-map-popup__meta">${patient.address_preview ?? 'ไม่ระบุที่อยู่'}</div>
    </div>
  `;
}

function renderMarkers(): void {
  if (!map || !markerLayer) return;

  markerLayer.clearLayers();
  const points = props.patients.filter(
    (patient) => typeof patient.lat === 'number' && typeof patient.lng === 'number',
  );

  if (points.length === 0) {
    map.setView([13.75, 100.5], 6);
    return;
  }

  const bounds = L.latLngBounds([]);

  for (const patient of points) {
    if (patient.lat == null || patient.lng == null) continue;
    const marker = L.marker([patient.lat, patient.lng], {
      icon: createIcon(statusColor(patient), patient.hn === props.selectedHn),
      title: patient.masked_name,
    });
    marker.on('click', () => emit('select', patient.hn));
    marker.bindPopup(popupContent(patient));
    markerLayer.addLayer(marker);
    bounds.extend(marker.getLatLng());
  }

  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.18), { maxZoom: 13 });
  }
}

onMounted(() => {
  if (!mapElement.value) return;

  map = L.map(mapElement.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView([13.75, 100.5], 6);

  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  });

  tileLayer.on('tileerror', () => {
    emit('mapError', 'ไม่สามารถโหลดแผนที่พื้นหลังจาก OpenStreetMap ได้');
  });

  tileLayer.addTo(map);
  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 44,
  });
  markerLayer.addTo(map);
  renderMarkers();
});

watch(
  () => [props.patients, props.selectedHn] as const,
  () => {
    renderMarkers();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  markerLayer?.clearLayers();
  markerLayer?.remove();
  tileLayer?.remove();
  map?.remove();
  markerLayer = null;
  tileLayer = null;
  map = null;
});
</script>

<template>
  <div class="map-card">
    <div ref="mapElement" class="map-surface" />
  </div>
</template>

<style scoped>
.map-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  min-height: 560px;
}

.map-surface {
  width: 100%;
  min-height: 560px;
}

:deep(.leaflet-control-attribution) {
  font-family: var(--font);
  font-size: 10.5px;
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  border: var(--border);
}

:deep(.leaflet-popup-content) {
  margin: 10px 12px;
  font-family: var(--font);
}

:deep(.tb-map-popup__title) {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 3px;
}

:deep(.tb-map-popup__meta) {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

:deep(.tb-map-marker-shell) {
  background: transparent;
  border: none;
}

:deep(.tb-map-marker) {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12), 0 6px 16px rgba(0, 0, 0, 0.16);
}

:deep(.tb-map-marker--selected) {
  box-shadow: 0 0 0 3px rgba(9, 127, 232, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.12);
}

@media (max-width: 1100px) {
  .map-card,
  .map-surface {
    min-height: 480px;
  }
}
</style>

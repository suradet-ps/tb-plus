<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  { size: 36 },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="5 9 14 11"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="TB Clinic Logo"
    role="img"
  >
    <!-- Drop-shadow offset shapes -->
    <path
      d="M10.5 9.4h-0.2C7.4 9.4 5 11.8 5 14.8c0 3 2.2 5.3 5.5 5.3 1 0 1-1 1-2v-8c0-1 0-1-1-1z"
      fill="#f6f5f4"
    />
    <path
      d="M13.5 9.4h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3-2.2 5.3-5.5 5.3-1 0-1-1-1-2v-8c0-1 0-1 1-1z"
      fill="#f6f5f4"
    />

    <!-- Left lobe — Teal (T) -->
    <path
      d="M10.5 9h-0.2C7.4 9 5 11.4 5 14.4c0 3.3 2.2 5.6 5.5 5.6 1 0 1-1 1-2v-8c0-1 0-1-1-1z"
      fill="#2a9d99"
      stroke="#238582"
      stroke-width="0.1"
    />

    <!-- Right lobe — Blue (B) -->
    <path
      d="M13.5 9h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3.3-2.2 5.6-5.5 5.6-1 0-1-1-1-2v-8c0-1 0-1 1-1z"
      fill="#0075de"
      stroke="#005bab"
      stroke-width="0.1"
      fill-opacity="0.9"
    />

    <!-- Letter T -->
    <text
      x="8.1"
      y="15.8"
      font-family="system-ui, -apple-system, sans-serif"
      font-weight="800"
      font-size="4"
      fill="#ffffff"
      text-anchor="middle"
    >T</text>

    <!-- Letter B -->
    <text
      x="15.9"
      y="15.8"
      font-family="system-ui, -apple-system, sans-serif"
      font-weight="800"
      font-size="4"
      fill="#ffffff"
      text-anchor="middle"
    >B</text>

    <!-- Highlight gloss strokes -->
    <path
      d="M10.5 9.2h-0.2C7.4 9.2 5.2 11.3 5.2 14.3"
      stroke="#ffffff"
      stroke-width="0.15"
      fill="none"
      stroke-opacity="0.4"
    />
    <path
      d="M13.5 9.2h0.2c2.9 0 5.1 2.3 5.1 5.3"
      stroke="#ffffff"
      stroke-width="0.15"
      fill="none"
      stroke-opacity="0.4"
    />
  </svg>
</template>
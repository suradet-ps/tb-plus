import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// ── Disable macOS autocapitalize / autocorrect on all inputs ────────────────
// WebKit on macOS auto-capitalises the first character of any <input> /
// <textarea> unless the element explicitly opts out. We patch every element
// as soon as it enters the DOM so Vue-rendered inputs are covered too.
function patchInputElement(el: Element): void {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.setAttribute('autocapitalize', 'none');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
  }
}

function patchSubtree(root: Element): void {
  patchInputElement(root);
  root.querySelectorAll('input, textarea').forEach(patchInputElement);
}

const inputPatcher = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        patchSubtree(node as Element);
      }
    });
  }
});

// Start observing before Vue mounts so no element is missed
inputPatcher.observe(document.documentElement, { childList: true, subtree: true });

// ── App bootstrap ────────────────────────────────────────────────────────────
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

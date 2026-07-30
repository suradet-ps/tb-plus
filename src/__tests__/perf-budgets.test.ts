import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

interface PerfBudgets {
  version: string;
  frontend: {
    total_js_gzip_kb: number;
    chunks: Record<string, number>;
    total_css_gzip_kb: number;
  };
  baseline?: {
    measured_at: string;
    version: string;
    actual_js_gzip_kb: number;
    actual_css_gzip_kb: number;
    actual_chunks: Record<string, number>;
  };
  rust_tests: { min_total: number };
  frontend_tests: { min_total: number; min_files: number };
}

const budgetsPath = resolve(
  // biome-ignore lint/style/noNonNullAssertion: import.meta.dirname is always defined in vitest
  import.meta.dirname!,
  '../../perf-budgets.json',
);
const budgets: PerfBudgets = JSON.parse(readFileSync(budgetsPath, 'utf-8'));

describe('Performance budgets', () => {
  describe('budget file structure', () => {
    it('should have a version field', () => {
      expect(typeof budgets).toBe('object');
      expect(budgets).toHaveProperty('version');
    });

    it('should have frontend chunk budgets for all manual chunks', () => {
      const expectedChunks = ['vue', 'leaflet', 'index'];
      for (const chunk of expectedChunks) {
        expect(budgets.frontend.chunks).toHaveProperty(chunk);
        expect(budgets.frontend.chunks[chunk]).toBeGreaterThan(0);
      }
    });

    it('should have total JS budget greater than sum of chunk budgets', () => {
      const chunkSum = Object.values(budgets.frontend.chunks).reduce((a, b) => a + b, 0);
      expect(budgets.frontend.total_js_gzip_kb).toBeGreaterThanOrEqual(chunkSum);
    });

    it('should have a baseline section with measured values', () => {
      expect(budgets.baseline).toBeDefined();
      expect(budgets.baseline?.actual_js_gzip_kb).toBeGreaterThan(0);
      expect(budgets.baseline?.actual_css_gzip_kb).toBeGreaterThan(0);
    });
  });

  describe('test count budgets', () => {
    it('should enforce minimum Rust test count', () => {
      expect(budgets.rust_tests.min_total).toBeGreaterThanOrEqual(48);
    });

    it('should enforce minimum frontend test count', () => {
      expect(budgets.frontend_tests.min_total).toBeGreaterThanOrEqual(236);
    });

    it('should enforce minimum frontend test file count', () => {
      expect(budgets.frontend_tests.min_files).toBeGreaterThanOrEqual(16);
    });
  });

  describe('actual build output vs budget', () => {
    // biome-ignore lint/style/noNonNullAssertion: import.meta.dirname is always defined in vitest
    const distDir = resolve(import.meta.dirname!, '../../dist/assets');

    function getGzipSize(filePath: string): number {
      const content = readFileSync(filePath);
      return gzipSync(content).length;
    }

    function getChunkGzipKB(chunkPrefix: string): number {
      const files = readdirSync(distDir);
      let totalGzip = 0;
      for (const f of files) {
        if (f.startsWith(chunkPrefix) && f.endsWith('.js')) {
          totalGzip += getGzipSize(join(distDir, f));
        }
      }
      return totalGzip / 1024;
    }

    it('total JS gzip should be under budget', () => {
      const files = readdirSync(distDir).filter((f) => f.endsWith('.js'));
      let totalGzip = 0;
      for (const f of files) {
        totalGzip += getGzipSize(join(distDir, f));
      }
      const totalKB = totalGzip / 1024;
      expect(totalKB).toBeLessThanOrEqual(budgets.frontend.total_js_gzip_kb);
    });

    it('total CSS gzip should be under budget', () => {
      const files = readdirSync(distDir).filter((f) => f.endsWith('.css'));
      let totalGzip = 0;
      for (const f of files) {
        totalGzip += getGzipSize(join(distDir, f));
      }
      const totalKB = totalGzip / 1024;
      expect(totalKB).toBeLessThanOrEqual(budgets.frontend.total_css_gzip_kb);
    });

    it('vue chunk should be under budget', () => {
      const vueKB = getChunkGzipKB('vue-');
      expect(vueKB).toBeLessThanOrEqual(budgets.frontend.chunks.vue);
    });

    it('leaflet chunk should be under budget', () => {
      const leafletKB = getChunkGzipKB('leaflet-');
      expect(leafletKB).toBeLessThanOrEqual(budgets.frontend.chunks.leaflet);
    });

    it('index chunk should be under budget', () => {
      const indexKB = getChunkGzipKB('index-');
      expect(indexKB).toBeLessThanOrEqual(budgets.frontend.chunks.index);
    });
  });
});

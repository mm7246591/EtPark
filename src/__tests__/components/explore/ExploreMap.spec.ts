import { expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ExploreMap from '../../../components/explore/ExploreMap.vue';

// Google Maps loader 載入時就會用到 window，SSR 測試只需要模板。
vi.mock('@/apis/googleMaps', () => ({
  mapsConfigured: true,
  loadMapsLibrary: vi.fn(),
  listenMapsQuotaError: vi.fn(),
}));

const props = { restaurants: [], parkingLots: [], selected: null };

it('查詢額度用盡時地圖區只留空白格線，不顯示圖示與文字', async () => {
  const html = await renderToString(
    createSSRApp(ExploreMap, { ...props, blocked: true })
  );
  expect(html).not.toContain('material-symbols-rounded');
  expect(html).not.toContain('<h2');
  const normal = await renderToString(
    createSSRApp(ExploreMap, { ...props, blocked: false })
  );
  expect(normal).toContain('<h2');
});

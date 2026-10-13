import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import ExploreSearchBar from '../../../components/explore/ExploreSearchBar.vue';

it('搜尋候選只呈現店名地址，不顯示距離或行車時間', async () => {
  const html = await renderToString(
    createSSRApp(ExploreSearchBar, {
      searching: false,
      searchMessage: '',
      loading: false,
      blocked: false,
      mapsConfigured: true,
      suggestions: [
        {
          id: 'store',
          name: '店家',
          description: '店家地址',
          address: '台北市',
          distance: 1234,
          prediction: {} as never,
        },
      ],
    })
  );
  expect(html).toMatch(/EtPark\s*<\/h1>/);
  const suggestions = html.slice(html.indexOf('role="listbox"'));
  expect(suggestions).toContain('店家');
  expect(suggestions).toContain('台北市');
  expect(suggestions).not.toMatch(/約 \d+ 分鐘/);
  expect(html).not.toContain('1.2 km');
});

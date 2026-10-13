import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TabsRoot } from 'reka-ui';
import { expect, it } from 'vitest';
import ExploreResultCards from '../../../components/explore/ExploreResultCards.vue';

const props = {
  noticeMessage: '',
  parkingNotice: '',
  activeKind: 'parking' as const,
  selected: null,
  loading: false,
  blocked: false,
  places: [
    {
      id: 'parking',
      name: '停車場',
      kind: 'parking' as const,
      address: '台北市',
      location: { lat: 25, lng: 121 },
      distance: 200,
      spaces: 12,
      price: '每小時 30 元；機車每次 20 元',
      drivingMinutes: 7,
    },
  ],
  foodCount: 1,
};
// TabsContent 需要父層 TabsRoot，比照 ExploreView 包一層。
const render = (overrides = {}) =>
  renderToString(
    createSSRApp({
      render: () =>
        h(TabsRoot, { modelValue: 'parking' }, () =>
          h(ExploreResultCards, { ...props, ...overrides })
        ),
    })
  );

it('停車場卡片顯示車位、距離分鐘、計費方式，選取後才展開開始導航', async () => {
  const html = await render();
  expect(html).toContain('搜尋範圍 1 公里 · 1 處');
  expect(html).toContain('實際費率以現場公告為準');
  expect(html).toContain('12 位');
  expect(html).toContain('200 m');
  expect(html).toContain('開車約 7 分鐘');
  expect(html).toContain('計費方式：30/hr');
  expect(html).not.toContain('20/次');
  expect(html).not.toContain('開始導航');
  expect(html).toContain('aria-label="收合清單"');
  const selected = await render({ selected: props.places[0] });
  expect(selected).toContain('開始導航');
  expect(selected).toContain('記錄車位');
});

it('未定位或沒有時間時不顯示時間與未提供提示', async () => {
  const html = await render({
    places: props.places.map((place) => ({ ...place, drivingMinutes: null })),
  });
  expect(html).not.toMatch(/約 \d+ 分鐘/);
  expect(html).not.toContain('距離未提供');
});

it('查詢額度用盡時清單區不顯示提示文字，只由對話框說明', async () => {
  const html = await render({ blocked: true, places: [] });
  expect(html).not.toContain('搜尋並選擇目的地');
  expect(html).not.toContain('資料載入中');
});

it('尚未選擇目的地時清單把手停用，不能收合', async () => {
  const handle = (html: string) =>
    html.match(/<button[^>]*aria-controls="results-panel"[^>]*>/)?.[0] ?? '';
  expect(handle(await render({ foodCount: 0, places: [] }))).toContain(
    'disabled'
  );
  expect(handle(await render())).not.toContain('disabled');
});

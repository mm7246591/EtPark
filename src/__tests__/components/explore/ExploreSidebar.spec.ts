import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import ExploreSidebar from '../../../components/explore/ExploreSidebar.vue';

const props = {
  searching: false,
  searchMessage: '',
  noticeMessage: '',
  source: '市府',
  parkingNotice: '',
  activeKind: 'parking' as const,
  selected: null,
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
  loading: false,
  blocked: false,
  mapsConfigured: true,
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

it('搜尋候選只呈現店名地址，停車場保留分鐘與開始導航', async () => {
  const html = await renderToString(createSSRApp(ExploreSidebar, props));
  expect(html).toContain('EtPark</h1>');
  expect(html).toContain('店家');
  expect(html).toContain('台北市');
  expect(html).toContain('role="listbox"');
  const suggestions = html.slice(
    html.indexOf('role="listbox"'),
    html.indexOf('aria-label="搜尋類別"')
  );
  expect(suggestions).toContain('店家');
  expect(suggestions).not.toMatch(/約 \d+ 分鐘/);
  expect(html).not.toContain('1.2 km');
  expect(html).toContain('剩餘車位');
  expect(html).toMatch(/>\s*12\s*</);
  expect(html).toContain('200 m');
  expect(html).toContain('開車約 7 分鐘');
  expect(html).toContain('計費方式：30/hr');
  expect(html).toContain('實際費率以現場公告為準');
  expect(html).not.toContain('20/次');
  expect(html).toContain('開始導航');
  expect(html).not.toContain('開車路線');
});

it('未定位或沒有時間時不顯示時間與未提供提示', async () => {
  const html = await renderToString(
    createSSRApp(ExploreSidebar, {
      ...props,
      places: props.places.map((place) => ({ ...place, drivingMinutes: null })),
    })
  );
  expect(html).not.toMatch(/約 \d+ 分鐘/);
  expect(html).not.toContain('距離未提供');
});

it('查詢額度用盡時清單區不顯示提示文字，只由對話框說明', async () => {
  const html = await renderToString(
    createSSRApp(ExploreSidebar, { ...props, blocked: true, places: [] })
  );
  expect(html).not.toContain('搜尋並選擇目的地');
  expect(html).not.toContain('資料載入中');
});

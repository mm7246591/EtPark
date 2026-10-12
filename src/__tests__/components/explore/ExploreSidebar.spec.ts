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
  blockedMessage: '',
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
      price: '每小時 30 元',
      drivingMinutes: 7,
    },
  ],
  foodCount: 1,
  parkingCount: 1,
};

it('搜尋候選只呈現店名地址，停車場保留分鐘與開始導航', async () => {
  const html = await renderToString(createSSRApp(ExploreSidebar, props));
  expect(html).toContain('EtPark</h1>');
  expect(html).toContain('店家');
  expect(html).toContain('台北市');
  expect(html.slice(0, html.indexOf('</ul>'))).not.toMatch(/約 \d+ 分鐘/);
  expect(html).not.toContain('1.2 km');
  expect(html.indexOf('剩餘車位：12')).toBeLessThan(html.indexOf('約 7 分鐘'));
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

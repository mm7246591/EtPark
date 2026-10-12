import { expect, it } from 'vitest';
import { getGoogleMapsNavigationUrl } from '../../../../views/explore/utils/navigation';

it('使用目的地座標開啟 Google Maps 開車導航，起點由 Google Maps 處理', () => {
  const url = new URL(getGoogleMapsNavigationUrl({ lat: 25.05, lng: 121.48 }));
  expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    api: '1',
    destination: '25.05,121.48',
    travelmode: 'driving',
    dir_action: 'navigate',
  });
});

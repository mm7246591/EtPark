import { expect, it } from 'vitest';
import { cityParkingSchema } from '../../../apis/schemas/nationalParking';

it('縣市回應保留未知車位與設定提示', () => {
  expect(
    cityParkingSchema.safeParse({
      lots: [
        {
          kind: 'parking',
          id: 'city-1',
          name: '停車場',
          address: '地址',
          location: { lat: 24.1, lng: 120.6 },
          distance: 0,
          price: '依現場公告',
          spaces: null,
        },
      ],
      source: '交通部 TDX',
      queriedAt: '',
      notice: '此縣市未提供車位',
    }).success
  ).toBe(true);
  expect(
    cityParkingSchema.safeParse({
      lots: [],
      source: '交通部 TDX',
      queriedAt: '',
      notice: '尚未設定金鑰',
    }).success
  ).toBe(true);
});

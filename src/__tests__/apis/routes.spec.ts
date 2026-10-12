import { beforeEach, expect, it, vi } from 'vitest';
import { getDrivingMinutes } from '../../apis/routes';

const computeRouteMatrix = vi.hoisted(() => vi.fn());
vi.mock('../../apis/googleMaps', () => ({
  loadMapsLibrary: async () => ({ RouteMatrix: { computeRouteMatrix } }),
}));
beforeEach(() => computeRouteMatrix.mockReset());

it('只查基本開車時間，按終點順序換算分鐘；查無路線與無效時間不偽造數值', async () => {
  computeRouteMatrix.mockResolvedValue({
    matrix: {
      rows: [
        {
          items: [
            { condition: 'ROUTE_EXISTS', durationMillis: 61000 },
            { condition: 'ROUTE_NOT_FOUND', error: new Error('no route') },
            { condition: 'ROUTE_EXISTS', durationMillis: Infinity },
            { condition: 'ROUTE_EXISTS', durationMillis: 0 },
          ],
        },
      ],
    },
  });
  const origin = { lat: 25, lng: 121 };
  const destinations = [
    'places/store',
    { lat: 25.1, lng: 121 },
    'places/other',
    origin,
  ];
  expect(await getDrivingMinutes(origin, destinations)).toEqual([
    2,
    null,
    null,
    1,
  ]);
  expect(computeRouteMatrix).toHaveBeenCalledWith({
    origins: [origin],
    destinations,
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_UNAWARE',
    fields: ['durationMillis', 'condition', 'error'],
    language: 'zh-TW',
    region: 'tw',
  });
});

it('元素配額錯誤與整筆請求錯誤保留給共用 dialog 處理', async () => {
  const error = Object.assign(new Error('Quota exhausted'), {
    code: 'RESOURCE_EXHAUSTED',
  });
  computeRouteMatrix.mockResolvedValueOnce({
    matrix: { rows: [{ items: [{ error }] }] },
  });
  await expect(
    getDrivingMinutes({ lat: 25, lng: 121 }, ['places/store'])
  ).rejects.toBe(error);
  computeRouteMatrix.mockRejectedValueOnce(error);
  await expect(
    getDrivingMinutes({ lat: 25, lng: 121 }, ['places/store'])
  ).rejects.toBe(error);
});

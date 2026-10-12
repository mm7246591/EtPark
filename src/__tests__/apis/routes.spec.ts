import { expect, it, vi } from 'vitest';
import { getRoute } from '../../apis/routes';

const computeRoutes = vi.hoisted(() => vi.fn());
vi.mock('../../apis/googleMaps', () => ({
  loadMapsLibrary: async () => ({ Route: { computeRoutes } }),
}));
it('只查基本開車路線，不取即時交通或額外路線，轉換距離、時間與座標', async () => {
  computeRoutes.mockResolvedValueOnce({
    routes: [
      {
        path: [{ toJSON: () => ({ lat: 25, lng: 121 }) }],
        distanceMeters: 1500,
        durationMillis: 300000,
        warnings: ['請留意道路'],
      },
    ],
  });
  const result = await getRoute(
    { lat: 25, lng: 121 },
    { lat: 25.1, lng: 121.1 }
  );
  expect(computeRoutes).toHaveBeenCalledWith(
    expect.objectContaining({
      travelMode: 'DRIVING',
      routingPreference: 'TRAFFIC_UNAWARE',
      fields: ['path', 'distanceMeters', 'durationMillis', 'warnings'],
      computeAlternativeRoutes: false,
    })
  );
  expect(result.distanceMeters).toBe(1500);
  expect(result.durationMillis).toBe(300000);
  expect(result.path).toEqual([{ lat: 25, lng: 121 }]);
});
it('沒有路線或摘要欄位時不顯示假的零距離與零分鐘', async () => {
  computeRoutes.mockResolvedValueOnce({ routes: [] });
  await expect(
    getRoute({ lat: 25, lng: 121 }, { lat: 26, lng: 122 })
  ).rejects.toThrow('無法取得此路線');
});

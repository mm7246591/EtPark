import { shallowRef, nextTick } from 'vue';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useExploreRoutes } from '../../../views/explore/composables/useExploreRoutes';
import type {
  ParkingLot,
  Restaurant,
} from '../../../views/explore/types/place';

const mocks = vi.hoisted(() => ({
  getRoute: vi.fn(),
  blocked: { value: false },
  error: vi.fn(),
}));
vi.mock('../../../apis/routes', () => ({ getRoute: mocks.getRoute }));
vi.mock('../../../composables/useApiUsage', () => ({
  useApiUsage: () => ({ blocked: mocks.blocked, handleApiError: mocks.error }),
}));
vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  onBeforeUnmount: vi.fn(),
}));
const parking: ParkingLot = {
  kind: 'parking',
  id: 'parking',
  name: '停車場',
  address: '台北市',
  location: { lat: 25.04, lng: 121.55 },
  distance: 100,
  spaces: 5,
  price: '40元',
};
const store: Restaurant = {
  kind: 'food',
  id: 'store',
  name: '店家',
  address: '台北市',
  location: { lat: 25.03, lng: 121.56 },
  distance: 0,
};
const route = {
  path: [
    { lat: 25, lng: 121 },
    { lat: 25.04, lng: 121.55 },
  ],
  distanceMeters: 2400,
  durationMillis: 360000,
  warnings: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.blocked.value = false;
  mocks.getRoute.mockResolvedValue(route);
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (value: unknown) => void) =>
        success({ coords: { latitude: 25, longitude: 121 } }),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it('一次點擊只查一段開車路線，沒有步行或外開頁面', async () => {
  const routes = useExploreRoutes(shallowRef(store));
  await routes.navigate(parking);
  expect(mocks.getRoute).toHaveBeenCalledTimes(1);
  expect(mocks.getRoute).toHaveBeenCalledWith(
    { lat: 25, lng: 121 },
    parking.location
  );
  expect(routes.preview.value?.driving).toEqual(route);
  expect(routes.preview.value?.placeName).toBe('停車場');
  expect(routes.routeLoading.value).toBe(false);
});
it('拒絕定位不消耗路線 API', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        _success: unknown,
        failure: (error: unknown) => void
      ) => failure({ code: 1 }),
    },
  });
  const routes = useExploreRoutes(shallowRef(store));
  await routes.navigate(parking);
  expect(mocks.getRoute).not.toHaveBeenCalled();
  expect(routes.routeNotice.value).toContain('定位權限未開啟');
});
it('關閉預覽後忽略舊回應；切換目的地清除已查路線', async () => {
  let resolve: (value: typeof route) => void = () => {};
  mocks.getRoute.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const destination = shallowRef<Restaurant | null>(store);
  const routes = useExploreRoutes(destination);
  const pending = routes.navigate(parking);
  await Promise.resolve();
  routes.closeRoute();
  resolve(route);
  await pending;
  expect(routes.preview.value).toBeNull();
  expect(routes.routeOpen.value).toBe(false);
  await routes.navigate(parking);
  expect(routes.preview.value).not.toBeNull();
  destination.value = { ...store, id: 'new' };
  await nextTick();
  expect(routes.preview.value).toBeNull();
});
it('錯誤交給共用 dialog，封鎖後不查定位或 API', async () => {
  const error = { code: 'RESOURCE_EXHAUSTED' };
  mocks.getRoute.mockRejectedValueOnce(error);
  const routes = useExploreRoutes(shallowRef(store));
  await routes.navigate(parking);
  expect(mocks.error).toHaveBeenCalledWith(error);
  mocks.blocked.value = true;
  await routes.navigate(parking);
  expect(mocks.getRoute).toHaveBeenCalledTimes(1);
});

import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { usePersonalPlaces } from '../../../views/explore/composables/usePersonalPlaces';
import type {
  ParkingLot,
  Restaurant,
} from '../../../views/explore/types/place';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
const parking: ParkingLot = {
  kind: 'parking',
  id: 'carpark',
  name: '停車場',
  address: '台北市',
  location: { lat: 25, lng: 121 },
  distance: 100,
  spaces: 8,
  drivingMinutes: 3,
  price: '30 元',
};
it('收藏可加入移除且重新讀取，不保存舊車位、費率與行車時間', () => {
  const personal = usePersonalPlaces();
  personal.toggleFavorite(parking);
  expect(personal.isFavorite(parking)).toBe(true);
  expect(usePersonalPlaces().favorites.value[0]?.name).toBe('停車場');
  const stored = [...values.values()][0]!;
  expect(stored).not.toContain('spaces');
  expect(stored).not.toContain('price');
  expect(stored).not.toContain('drivingMinutes');
  personal.toggleFavorite(parking);
  expect(usePersonalPlaces().favorites.value).toEqual([]);
});
it('最近搜尋去重保留十筆，停車記錄可編輯清除並保存備註', () => {
  const personal = usePersonalPlaces();
  for (let index = 0; index < 12; index += 1)
    personal.addRecent({
      ...parking,
      kind: 'food',
      id: String(index),
    } as Restaurant);
  personal.addRecent({ ...parking, kind: 'food', id: '8' } as Restaurant);
  expect(personal.recent.value).toHaveLength(10);
  expect(personal.recent.value[0]?.id).toBe('8');
  personal.toggleFavorite(parking);
  personal.saveParking(personal.favorites.value[0]!, ' B2／C 區／125 ');
  expect(usePersonalPlaces().parked.value?.note).toBe('B2／C 區／125');
  personal.clearParking();
  personal.clearRecent();
  expect(usePersonalPlaces().parked.value).toBeNull();
  expect(usePersonalPlaces().recent.value).toEqual([]);
});
it('損壞或無法使用的儲存空間不讓頁面崩潰，顯示本機儲存失敗提示', () => {
  values.set('etpark-personal-v1', '{bad json');
  const personal = usePersonalPlaces();
  expect(personal.favorites.value).toEqual([]);
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  personal.toggleFavorite(parking);
  expect(personal.storageMessage.value).toContain('無法儲存');
});

it('收藏只接受停車場，店家只保留在最近搜尋', () => {
  const personal = usePersonalPlaces();
  const restaurant = {
    ...parking,
    kind: 'food',
    id: 'restaurant',
  } as Restaurant;
  personal.toggleFavorite(restaurant);
  expect(personal.favorites.value).toEqual([]);
  personal.addRecent(restaurant);
  expect(personal.recent.value[0]?.id).toBe('restaurant');
});

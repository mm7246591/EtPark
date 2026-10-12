import { expect, it } from 'vitest';
import { filterAndSortParking } from '../../../../views/explore/utils/parkingOptions';
import type { ParkingLot } from '../../../../views/explore/types/place';

const lots = [
  ['full', 0, 50, '免費'],
  ['unknown', null, 100, '依現場公告'],
  ['near', 2, 200, '每小時40元'],
  ['far', 20, 800, '每半小時15元'],
  ['outside', 6, 1800, '每小時20元'],
].map(
  ([id, spaces, distance, price]) =>
    ({ id, spaces, distance, price }) as ParkingLot
);
const ids = (values: ParkingLot[]) => values.map((lot) => lot.id);
it('全部取消預設距離排序；剩餘車位排除未知，所有模式排除滿位', () => {
  expect(ids(filterAndSortParking(lots, 1000, []))).toEqual([
    'unknown',
    'near',
    'far',
  ]);
  expect(ids(filterAndSortParking(lots, 1000, ['spaces']))).toEqual([
    'far',
    'near',
  ]);
  expect(ids(filterAndSortParking(lots, 3000, ['distance']))).toEqual([
    'unknown',
    'near',
    'far',
    'outside',
  ]);
  expect(ids(filterAndSortParking(lots, 1000, ['price']))).toEqual([
    'far',
    'near',
    'unknown',
  ]);
  expect(ids(lots)).toEqual(['full', 'unknown', 'near', 'far', 'outside']);
});
it('多選依勾選先後，第一項相同時比較下一項；未知費率仍可用下一項排序', () => {
  const tied = [
    ['a', 5, 100, '每小時50元'],
    ['b', 5, 200, '每小時30元'],
    ['c', 8, 300, '每小時50元'],
  ].map(
    ([id, spaces, distance, price]) =>
      ({ id, spaces, distance, price }) as ParkingLot
  );
  expect(ids(filterAndSortParking(tied, 1000, ['spaces', 'price']))).toEqual([
    'c',
    'b',
    'a',
  ]);
  expect(ids(filterAndSortParking(tied, 1000, ['price', 'spaces']))).toEqual([
    'b',
    'c',
    'a',
  ]);
  expect(
    ids(
      filterAndSortParking(
        tied.map((lot) => ({ ...lot, price: '依現場公告' })),
        1000,
        ['price', 'spaces']
      )
    )
  ).toEqual(['c', 'a', 'b']);
});

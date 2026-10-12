import { describe, expect, it } from 'vitest';
import { findNearbyParking } from '../../../views/explore/utils/parking';
import type {
  ParkingDescriptions,
  ParkingAvailability,
} from '../../../apis/types/taipeiParking';

const description: ParkingDescriptions = {
  data: {
    UPDATETIME: new Date().toISOString(),
    park: [
      {
        id: 'TPE0001',
        name: '長春停車場',
        address: '長春路17號',
        payex: '100元/時',
        type: '1',
        totalcar: 17,
        tw97x: '302864.7812',
        tw97y: '2771988.958',
      },
    ],
  },
};
const availability = (
  spaces: number,
  time = new Date().toISOString()
): ParkingAvailability => ({
  data: { UPDATETIME: time, park: [{ id: 'TPE0001', availablecar: spaces }] },
});
describe('台北停車資料', () => {
  it('依停車場 id 配對、轉換 TWD97 座標並以距離篩選', () => {
    const result = findNearbyParking(description, availability(12), {
      lat: 25.0552,
      lng: 121.5242,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.location.lat).toBeCloseTo(25.0552, 3);
    expect(result[0]?.location.lng).toBeCloseTo(121.5242, 3);
    expect(result[0]?.spaces).toBe(12);
    expect(result[0]?.distance).toBeLessThan(50);
    expect(
      findNearbyParking(description, availability(12), {
        lat: 25.03,
        lng: 121.56,
      })
    ).toEqual([]);
  });
  it('滿位、負值、缺資料、静態停車場與過期資料不混淆', () => {
    const center = { lat: 25.0552, lng: 121.5242 };
    expect(
      findNearbyParking(description, availability(0), center)[0]?.spaces
    ).toBe(0);
    expect(
      findNearbyParking(description, availability(-9), center)[0]?.spaces
    ).toBeNull();
    expect(findNearbyParking(description, null, center)[0]?.spaces).toBeNull();
    expect(
      findNearbyParking(description, availability(12, '2020-01-01'), center)[0]
        ?.spaces
    ).toBeNull();
    const item = description.data.park[0]!;
    expect(
      findNearbyParking(
        { data: { ...description.data, park: [{ ...item, type: '2' }] } },
        availability(12),
        center
      )[0]?.spaces
    ).toBeNull();
  });
});

import proj4 from 'proj4';
import type {
  ParkingDescriptions,
  ParkingAvailability,
} from '@/apis/types/taipeiParking';
import type { Coordinates, ParkingLot } from '../types/place';

const distanceInMeters = (a: Coordinates, b: Coordinates) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(
    6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
};
const findNearbyParking = (
  description: ParkingDescriptions,
  availability: ParkingAvailability | null,
  center: Coordinates,
  radius = 1000
): ParkingLot[] => {
  if (!Array.isArray(description?.data?.park))
    throw new Error('停車場資料格式不符');
  // 台北來源的 CST 為 UTC+8，避免被 JavaScript 解讀成美國中部時間。
  const updated = Date.parse(
    (availability?.data?.UPDATETIME ?? '').replace(' CST ', ' GMT+0800 ')
  );
  const fresh =
    Number.isFinite(updated) && Math.abs(Date.now() - updated) < 15 * 60 * 1000;
  const spaces = new Map(
    (fresh && Array.isArray(availability?.data?.park)
      ? availability.data.park
      : []
    ).map((item) => [item.id, item.availablecar])
  );
  return description.data.park
    .flatMap((item) => {
      const x = Number(item.tw97x);
      const y = Number(item.tw97y);
      if (
        !(item.totalcar > 0) ||
        !item.id ||
        !item.name ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x <= 0 ||
        y <= 0
      )
        return [];
      const [lng, lat] = proj4(
        '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
        'EPSG:4326',
        [x, y]
      );
      if (
        lat === undefined ||
        lng === undefined ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      )
        return [];
      const location = { lat, lng };
      const distance = distanceInMeters(center, location);
      if (distance > radius) return [];
      const count = spaces.get(item.id);
      return [
        {
          kind: 'parking' as const,
          id: item.id,
          name: item.name,
          address: item.address,
          price: item.payex || '依現場公告',
          location,
          distance,
          spaces:
            item.type === '1' &&
            Number.isInteger(count) &&
            count !== undefined &&
            count >= 0
              ? count
              : null,
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
};
export { distanceInMeters, findNearbyParking };

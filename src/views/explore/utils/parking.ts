import type { Coordinates } from '../types/place';

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
export { distanceInMeters };

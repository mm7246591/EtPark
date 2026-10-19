import { assertApiRequestAllowed } from '@/utils/apiRateLimit';
import { loadMapsLibrary } from './googleMaps';
import type { DrivingDestination } from './types/routes';

export const getDrivingMinutes = async (
  origin: google.maps.LatLngLiteral,
  destinations: DrivingDestination[]
): Promise<(number | null)[]> => {
  if (!destinations.length) return [];
  const { RouteMatrix } = await loadMapsLibrary('routes');
  assertApiRequestAllowed();
  const { matrix } = await RouteMatrix.computeRouteMatrix({
    origins: [origin],
    destinations,
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_UNAWARE',
    fields: ['durationMillis', 'condition', 'error'],
    language: 'zh-TW',
    region: 'tw',
  });
  return destinations.map((_, index) => {
    const item = matrix.rows[0]?.items[index];
    if (item?.condition === 'ROUTE_NOT_FOUND') return null;
    if (item?.error) throw item.error;
    const duration = item?.durationMillis;
    return item?.condition === 'ROUTE_EXISTS' &&
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      duration >= 0
      ? Math.max(1, Math.ceil(duration / 60000))
      : null;
  });
};

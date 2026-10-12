import { loadMapsLibrary } from './googleMaps';
import type { RouteResult } from './types/routes';

export const getRoute = async (
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<RouteResult> => {
  const { Route } = await loadMapsLibrary('routes');
  const { routes } = await Route.computeRoutes({
    origin,
    destination,
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_UNAWARE',
    fields: ['path', 'distanceMeters', 'durationMillis', 'warnings'],
    language: 'zh-TW',
    region: 'tw',
    computeAlternativeRoutes: false,
  });
  const route = routes?.[0];
  if (
    !route?.path?.length ||
    !Number.isFinite(route.distanceMeters) ||
    !Number.isFinite(route.durationMillis)
  )
    throw new Error('無法取得此路線');
  return {
    path: route.path.map((point) => point.toJSON()),
    distanceMeters: route.distanceMeters!,
    durationMillis: route.durationMillis!,
    warnings: route.warnings ?? [],
  };
};

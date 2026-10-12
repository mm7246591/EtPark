interface RouteResult {
  path: google.maps.LatLngLiteral[];
  distanceMeters: number;
  durationMillis: number;
  warnings: string[];
}
export type { RouteResult };

import type { Coordinates } from '../types/place';

const getGoogleMapsNavigationUrl = ({ lat, lng }: Coordinates) => {
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lng}`,
    travelmode: 'driving',
    dir_action: 'navigate',
  });
  return `https://www.google.com/maps/dir/?${params}`;
};

export { getGoogleMapsNavigationUrl };

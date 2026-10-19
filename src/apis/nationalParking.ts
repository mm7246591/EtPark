import { assertApiRequestAllowed } from '@/utils/apiRateLimit';
import { useApiUsage } from '@/composables/useApiUsage';
import { requestWithSchema } from './requestWithSchema';
import { cityParkingSchema } from './schemas/nationalParking';

export const getCityParking = async (
  city: string,
  location?: { lat: number; lng: number }
) => {
  const { blocked, handleApiError } = useApiUsage();
  if (blocked.value) throw new Error('API quota exceeded');
  try {
    assertApiRequestAllowed();
    return await requestWithSchema(cityParkingSchema, {
      url: `/api/parking/city?city=${encodeURIComponent(city)}${location ? `&lat=${location.lat}&lng=${location.lng}` : ''}`,
    });
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

import { requestWithSchema } from './requestWithSchema';
import {
  parkingDescriptionsSchema,
  parkingAvailabilitySchema,
} from './schemas/taipeiParking';

export const getParkingDescriptions = () =>
  requestWithSchema(parkingDescriptionsSchema, {
    url: '/api/parking/description',
  });
export const getParkingAvailability = () =>
  requestWithSchema(parkingAvailabilitySchema, {
    url: '/api/parking/availability',
  });

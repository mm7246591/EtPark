import * as z from 'zod/mini';

const descriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  payex: z.string(),
  tw97x: z.string(),
  tw97y: z.string(),
  type: z.string(),
  totalcar: z.number(),
});
const availabilitySchema = z.object({
  id: z.string(),
  availablecar: z.number(),
});
const parkingDescriptionsSchema = z.object({
  data: z.object({ UPDATETIME: z.string(), park: z.array(descriptionSchema) }),
});
const parkingAvailabilitySchema = z.object({
  data: z.object({ UPDATETIME: z.string(), park: z.array(availabilitySchema) }),
});
type ParkingDescription = z.infer<typeof descriptionSchema>;
type ParkingDescriptions = z.infer<typeof parkingDescriptionsSchema>;
type ParkingAvailability = z.infer<typeof parkingAvailabilitySchema>;
export { parkingDescriptionsSchema, parkingAvailabilitySchema };
export type { ParkingDescription, ParkingDescriptions, ParkingAvailability };

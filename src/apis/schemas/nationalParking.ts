import * as z from 'zod/mini';

const lotSchema = z.object({
  kind: z.literal('parking'),
  id: z.string(),
  name: z.string(),
  address: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  distance: z.number(),
  price: z.string(),
  spaces: z.nullable(z.number()),
});
const cityParkingSchema = z.object({
  lots: z.array(lotSchema),
  source: z.string(),
  queriedAt: z.string(),
  notice: z.string(),
});
type CityParking = z.infer<typeof cityParkingSchema>;
export { cityParkingSchema };
export type { CityParking };

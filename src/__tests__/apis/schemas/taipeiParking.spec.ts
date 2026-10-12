import { expect, it } from 'vitest';
import {
  parkingDescriptionsSchema,
  parkingAvailabilitySchema,
} from '../../../apis/schemas/taipeiParking';

it('驗證實際 API 欄位並保留原始負值契約', () => {
  expect(
    parkingDescriptionsSchema.safeParse({
      data: {
        UPDATETIME: 'Thu Oct 08 10:32:00 CST 2026',
        park: [
          {
            id: 'TPE0001',
            name: '台灣聯通長春停車場',
            address: '長春路17號地下1層',
            payex: '計時：100元/時',
            tw97x: '302864.7812',
            tw97y: '2771988.958',
            type: '1',
            totalcar: 17,
            FareInfo: {},
          },
        ],
      },
    }).success
  ).toBe(true);
  expect(
    parkingAvailabilitySchema.safeParse({
      data: {
        UPDATETIME: 'Thu Oct 08 10:32:00 CST 2026',
        park: [{ id: 'TPE0001', availablecar: -9, availablemotor: -9 }],
      },
    }).success
  ).toBe(true);
});

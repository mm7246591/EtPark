import type { ParkingLot } from '../types/place';
import type { ParkingSort } from '../types/personal';
import { getOneHourParkingFee } from './parkingFee';

const filterAndSortParking = (
  lots: ParkingLot[],
  radius: number,
  sorts: ParkingSort[]
) =>
  lots
    .filter(
      (lot) =>
        lot.spaces !== 0 &&
        lot.distance <= radius &&
        (!sorts.includes('spaces') || (lot.spaces ?? 0) > 0)
    )
    .sort((a, b) => {
      for (let index = 0; index < sorts.length; index += 1) {
        const sort = sorts[index];
        let difference = 0;
        if (sort === 'spaces') difference = (b.spaces ?? -1) - (a.spaces ?? -1);
        else if (sort === 'distance') difference = a.distance - b.distance;
        else {
          const first = getOneHourParkingFee(a.price ?? '');
          const second = getOneHourParkingFee(b.price ?? '');
          if (first === null && second !== null) difference = 1;
          else if (first !== null && second === null) difference = -1;
          else if (first !== null && second !== null)
            difference = first - second;
        }
        if (difference) return difference;
      }
      return a.distance - b.distance;
    });

export { filterAndSortParking };

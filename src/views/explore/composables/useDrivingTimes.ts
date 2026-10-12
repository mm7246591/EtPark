import { getDrivingMinutes } from '@/apis/routes';
import type { DrivingDestination } from '@/apis/types/routes';
import { useApiUsage } from '@/composables/useApiUsage';
import type { Coordinates } from '../types/place';

export const useDrivingTimes = () => {
  const { blocked, handleApiError } = useApiUsage();
  const cache = new Map<string, { minutes: number | null; expires: number }>();
  const getMinutes = async (
    origin: Coordinates,
    destinations: DrivingDestination[],
    isCurrent: () => boolean
  ) => {
    const key = (destination: DrivingDestination) =>
      JSON.stringify([origin, destination]);
    const missing = [
      ...new Map(
        destinations
          .filter(
            (destination) =>
              (cache.get(key(destination))?.expires ?? 0) <= Date.now()
          )
          .map((destination) => [key(destination), destination])
      ).values(),
    ];
    // 每批最多 50 個終點，符合地點 ID 與座標共用的矩陣限制。
    for (let index = 0; index < missing.length; index += 50) {
      if (blocked.value || !isCurrent()) return [];
      const batch = missing.slice(index, index + 50);
      let minutes: (number | null)[];
      try {
        // eslint-disable-next-line no-await-in-loop -- 逐批查詢，配額錯誤時停止後續批次。
        minutes = await getDrivingMinutes(origin, batch);
      } catch (error) {
        if (isCurrent()) handleApiError(error);
        return [];
      }
      batch.forEach((destination, offset) => {
        cache.set(key(destination), {
          minutes: minutes[offset] ?? null,
          expires: Date.now() + 300000,
        });
      });
    }
    return destinations.map(
      (destination) => cache.get(key(destination))?.minutes ?? null
    );
  };
  return { getMinutes };
};

import { shallowRef, watch, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import { getRoute } from '@/apis/routes';
import { useApiUsage } from '@/composables/useApiUsage';
import type { Place, Restaurant, Coordinates } from '../types/place';
import type { RoutePreview } from '../types/routes';

export const useExploreRoutes = (destination: Ref<Restaurant | null>) => {
  const { blocked, handleApiError } = useApiUsage();
  const preview = shallowRef<RoutePreview | null>(null);
  const routeLoading = shallowRef(false);
  const routeOpen = shallowRef(false);
  const routeNotice = shallowRef('');
  let sequence = 0;
  let disposed = false;
  const closeRoute = () => {
    sequence += 1;
    preview.value = null;
    routeOpen.value = false;
    routeLoading.value = false;
    routeNotice.value = '';
  };
  watch(destination, closeRoute);
  watch(blocked, (value) => {
    if (value) closeRoute();
  });
  onBeforeUnmount(() => {
    disposed = true;
    closeRoute();
  });
  const navigate = async (place: Place) => {
    if (blocked.value || disposed || routeLoading.value) return;
    closeRoute();
    routeOpen.value = true;
    if (!navigator.geolocation) {
      routeNotice.value = '此瀏覽器不支援定位，無法規劃從目前位置出發的路線。';
      return;
    }
    const request = ++sequence;
    const current = () => request === sequence && !disposed && !blocked.value;
    routeLoading.value = true;
    let origin: Coordinates;
    try {
      origin = await new Promise<Coordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) =>
            resolve({ lat: coords.latitude, lng: coords.longitude }),
          reject,
          { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
        );
      });
    } catch (error) {
      if (current()) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? error.code
            : undefined;
        if (code === 1)
          routeNotice.value =
            '定位權限未開啟，請在瀏覽器網站設定允許位置，並確認裝置定位服務已開啟。';
        else if (code === 3)
          routeNotice.value =
            '定位逾時，請確認裝置定位服務與網路後再次點擊開車路線。';
        else
          routeNotice.value =
            '目前無法取得位置，請確認裝置定位服務已開啟後再次點擊開車路線。';
        routeLoading.value = false;
      }
      return;
    }
    try {
      if (!current()) return;
      const driving = await getRoute(origin, place.location);
      if (!current()) return;
      preview.value = {
        placeName: place.name,
        driving,
      };
    } catch (error) {
      if (current()) {
        routeNotice.value = '路線暫時無法取得，請稍後重試。';
        handleApiError(error);
      }
    } finally {
      if (request === sequence) routeLoading.value = false;
    }
  };
  return {
    preview,
    routeLoading,
    routeOpen,
    routeNotice,
    navigate,
    closeRoute,
  };
};

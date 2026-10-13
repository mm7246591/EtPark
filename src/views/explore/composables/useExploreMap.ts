import { useApiUsage } from '@/composables/useApiUsage';
import { onMounted, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import {
  loadMapsLibrary,
  mapsConfigured,
  listenMapsQuotaError,
} from '@/apis/googleMaps';
import type { Place } from '../types/place';

export const useExploreMap = (
  host: Ref<HTMLElement | null>,
  places: Ref<Place[]>,
  selected: Ref<Place | null>
) => {
  const { blocked, handleApiError, dialogMessage } = useApiUsage();
  const markers = shallowRef<
    {
      place: Place;
      host: HTMLElement;
      marker: google.maps.marker.AdvancedMarkerElement;
    }[]
  >([]);
  const mapError = shallowRef(
    mapsConfigured ? '' : '尚未設定 Google Maps API key'
  );
  const ready = shallowRef(false);
  let map: google.maps.Map | undefined;
  let markerLibrary: google.maps.MarkerLibrary | undefined;
  let disposed = false;
  let stopListening: (() => void) | undefined;
  const clear = () => {
    markers.value.forEach((entry) => {
      const { marker } = entry;
      marker.map = null;
    });
    markers.value = [];
  };
  // 搜尋膠囊、操作列與桌面左側面板蓋在地圖邊緣，縮放時留白讓標記落在看得到的範圍。
  // ponytail: 依目前浮層尺寸估算，浮層尺寸改變時要同步調整。
  const fitPadding = () =>
    window.matchMedia('(min-width: 768px)').matches
      ? { top: 84, right: 60, bottom: 60, left: 480 }
      : { top: 130, right: 40, bottom: 40, left: 40 };
  const render = () => {
    if (blocked.value || !map || !markerLibrary) return;
    clear();
    const bounds = new google.maps.LatLngBounds();
    markers.value = places.value.map((place) => {
      const content = document.createElement('div');
      const marker = new markerLibrary!.AdvancedMarkerElement({
        map,
        position: place.location,
        content,
        title: place.name,
        // 目的地圖釘疊在停車場標記上方，不被周邊標記蓋住。
        zIndex: place.kind === 'food' ? 1_000_000 : undefined,
      });
      bounds.extend(place.location);
      return { place, host: content, marker };
    });
    if (places.value.length > 1) map.fitBounds(bounds, fitPadding());
    else if (places.value[0]) {
      map.setCenter(places.value[0].location);
      map.setZoom(16);
    }
  };
  watch(places, render);
  watch(selected, (place) => {
    if (!blocked.value && place && map) map.panTo(place.location);
  });
  watch(blocked, (value) => {
    if (!value) return;
    clear();
    if (map) google.maps.event.clearInstanceListeners(map);
    map = undefined;
    host.value?.replaceChildren();
    ready.value = false;
  });
  onMounted(async () => {
    if (!mapsConfigured) return;
    stopListening = listenMapsQuotaError(handleApiError);
    try {
      if (disposed || blocked.value) return;
      const [maps, marker] = await Promise.all([
        loadMapsLibrary('maps'),
        loadMapsLibrary('marker'),
      ]);
      if (disposed || !host.value) return;
      if (blocked.value) return;
      markerLibrary = marker;
      map = new maps.Map(host.value, {
        center: { lat: 25.0478, lng: 121.517 },
        zoom: 15,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        // 版面不放縮放鈕，縮放改用手勢或滑鼠滾輪。
        cameraControl: false,
        clickableIcons: false,
      });
      ready.value = true;
      render();
    } catch (error) {
      if (!disposed) handleApiError(error);
      if (!disposed) mapError.value = dialogMessage.value;
    }
  });
  onBeforeUnmount(() => {
    disposed = true;
    stopListening?.();
    clear();
    if (map) google.maps.event.clearInstanceListeners(map);
  });
  return { markers, mapError, ready };
};

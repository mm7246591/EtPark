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
      });
      bounds.extend(place.location);
      return { place, host: content, marker };
    });
    if (places.value.length > 1) map.fitBounds(bounds, 60);
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
    mapError.value = dialogMessage.value;
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

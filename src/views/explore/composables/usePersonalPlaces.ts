import { shallowRef } from 'vue';
import * as z from 'zod/mini';
import type { Place, Restaurant } from '../types/place';
import type { SavedPlace, ParkingRecord } from '../types/personal';

const savedPlaceSchema = z.object({
  id: z.string(),
  kind: z.enum(['food', 'parking']),
  name: z.string(),
  address: z.string(),
  location: z.object({
    lat: z.number().check(z.minimum(-90), z.maximum(90)),
    lng: z.number().check(z.minimum(-180), z.maximum(180)),
  }),
  savedAt: z.number(),
});
const storageSchema = z.object({
  favorites: z.array(savedPlaceSchema).check(z.maxLength(50)),
  recent: z.array(savedPlaceSchema).check(z.maxLength(10)),
  parked: z.nullable(
    z.object({
      place: savedPlaceSchema,
      note: z.string().check(z.maxLength(160)),
      savedAt: z.number(),
    })
  ),
});
const storageKey = 'etpark-personal-v1';
const toSavedPlace = (place: Place): SavedPlace => ({
  id: place.id,
  kind: place.kind,
  name: place.name,
  address: place.address,
  location: { ...place.location },
  savedAt: Date.now(),
});

export const usePersonalPlaces = () => {
  const favorites = shallowRef<SavedPlace[]>([]);
  const recent = shallowRef<SavedPlace[]>([]);
  const parked = shallowRef<ParkingRecord | null>(null);
  const storageMessage = shallowRef('');
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const result = storageSchema.safeParse(JSON.parse(raw));
      if (result.success) {
        const valid = (place: SavedPlace) =>
          Date.now() - place.savedAt < 30 * 86400000;
        favorites.value = result.data.favorites.filter(
          (place) => place.kind === 'parking' && valid(place)
        );
        recent.value = result.data.recent.filter(valid);
        parked.value = result.data.parked;
      }
    }
  } catch {
    storageMessage.value = '此瀏覽器無法讀取本機紀錄。';
  }
  const persist = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: favorites.value,
          recent: recent.value,
          parked: parked.value,
        })
      );
      storageMessage.value = '';
    } catch {
      storageMessage.value = '無法儲存至瀏覽器；目前紀錄只保留到關閉頁面。';
    }
  };
  const isFavorite = (place: Pick<SavedPlace, 'id' | 'kind'>) =>
    favorites.value.some(
      (item) => item.id === place.id && item.kind === place.kind
    );
  const removeFavorite = (place: SavedPlace) => {
    favorites.value = favorites.value.filter(
      (item) => item.id !== place.id || item.kind !== place.kind
    );
    persist();
  };
  const toggleFavorite = (place: Place) => {
    if (place.kind !== 'parking') return;
    if (isFavorite(place)) {
      favorites.value = favorites.value.filter(
        (item) => item.id !== place.id || item.kind !== place.kind
      );
    } else if (favorites.value.length < 50) {
      favorites.value = [toSavedPlace(place), ...favorites.value];
    } else {
      storageMessage.value = '最多收藏 50 個地點，請先移除部分收藏。';
      return;
    }
    persist();
  };
  const addRecent = (place: Restaurant) => {
    if (place.id === 'current-location') return;
    recent.value = [
      toSavedPlace(place),
      ...recent.value.filter((item) => item.id !== place.id),
    ].slice(0, 10);
    persist();
  };
  const clearRecent = () => {
    recent.value = [];
    persist();
  };
  const saveParking = (place: SavedPlace, note: string) => {
    parked.value = {
      place,
      note: note.trim().slice(0, 160),
      savedAt: Date.now(),
    };
    persist();
  };
  const clearParking = () => {
    parked.value = null;
    persist();
  };
  return {
    favorites,
    recent,
    parked,
    storageMessage,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    addRecent,
    clearRecent,
    saveParking,
    clearParking,
  };
};

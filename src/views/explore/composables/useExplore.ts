import { useApiUsage } from '@/composables/useApiUsage';
import { computed, shallowRef, onBeforeUnmount } from 'vue';
import { getCityParking } from '@/apis/nationalParking';
import { loadMapsLibrary, mapsConfigured } from '@/apis/googleMaps';
import { distanceInMeters } from '../utils/parking';
import { cities } from '../constants/cities';
import { useDrivingTimes } from './useDrivingTimes';
import { filterAndSortParking } from '../utils/parkingOptions';
import { getShortTermParkingFee } from '../utils/parkingFee';
import { parkingRadius } from '../constants/parking';
import type { SavedPlace, ParkingSort } from '../types/personal';
import type {
  Coordinates,
  Place,
  PlaceKind,
  Restaurant,
  ParkingLot,
  SearchSuggestion,
} from '../types/place';

export const useExplore = () => {
  const { blocked, handleApiError, dialogMessage } = useApiUsage();
  const { getMinutes } = useDrivingTimes();
  const activeKind = shallowRef<PlaceKind>('food');
  const selected = shallowRef<Place | null>(null);
  const destination = shallowRef<Restaurant | null>(null);
  const allParkingLots = shallowRef<ParkingLot[]>([]);
  const radius = shallowRef(parkingRadius);
  const expanding = shallowRef(false);
  const parkingSort = shallowRef<ParkingSort[]>([]);
  const drivingTimes = shallowRef<Record<string, number | null>>({});
  const parkingTotal = computed(
    () =>
      allParkingLots.value.filter(
        (lot) => lot.spaces !== 0 && lot.distance <= radius.value
      ).length
  );
  const parkingLots = computed(() =>
    filterAndSortParking(
      allParkingLots.value.map((lot) => ({
        ...lot,
        drivingMinutes: drivingTimes.value[lot.id],
      })),
      radius.value,
      parkingSort.value
    )
  );
  const suggestions = shallowRef<SearchSuggestion[]>([]);
  const loading = shallowRef(false);
  const searching = shallowRef(false);
  const origin = shallowRef<Coordinates | null>(null);
  const searchMessage = shallowRef('');
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchQuery = '';
  let disposed = false;
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(searchTimer);
    sequence += 1;
  });
  const message = shallowRef('');
  const source = shallowRef('尚未查詢');
  const parkingNotice = shallowRef('');
  const restaurants = computed(() =>
    destination.value ? [destination.value] : []
  );
  const places = computed(() =>
    activeKind.value === 'food' ? restaurants.value : parkingLots.value
  );
  let sequence = 0;
  let token: google.maps.places.AutocompleteSessionToken | undefined;
  let timeSequence = 0;
  const loadTimes = async () => {
    if (!origin.value || blocked.value || disposed || !mapsConfigured) return;
    const request = ++timeSequence;
    const destinationRequest = sequence;
    const lots = allParkingLots.value.filter(
      (lot) => lot.spaces !== 0 && lot.distance <= radius.value
    );
    const isCurrent = () =>
      request === timeSequence &&
      destinationRequest === sequence &&
      !disposed &&
      !blocked.value;
    const minutes = await getMinutes(
      origin.value,
      lots.map((lot) => lot.location),
      isCurrent
    );
    if (isCurrent())
      drivingTimes.value = {
        ...drivingTimes.value,
        ...Object.fromEntries(
          lots.map((lot, index) => [lot.id, minutes[index] ?? null])
        ),
      };
  };
  const adjustRange = async (request: number) => {
    const hasSpaces = () =>
      allParkingLots.value.some(
        (lot) => (lot.spaces ?? 0) > 0 && lot.distance <= radius.value
      );
    while (radius.value < 3000 && !hasSpaces()) {
      expanding.value = true;
      // 讓使用者看見自動擴大範圍的狀態，並逐步更新至 2／3 公里。
      // eslint-disable-next-line no-await-in-loop -- 每次調整都要檢查請求是否仍有效。
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
      if (request !== sequence || disposed || blocked.value) return;
      radius.value += 1000;
    }
    if (request === sequence) expanding.value = false;
  };
  const loadNearby = async (place: Restaurant) => {
    if (disposed || blocked.value) return;
    clearTimeout(searchTimer);
    searching.value = false;
    const request = ++sequence;
    radius.value = parkingRadius;
    expanding.value = false;
    destination.value = place;
    selected.value = place;
    activeKind.value = 'parking';
    allParkingLots.value = [];
    drivingTimes.value = {};
    source.value = '查詢中';
    parkingNotice.value = '';
    suggestions.value = [];
    loading.value = true;
    message.value = '';
    try {
      const address = place.address.replaceAll('臺', '台');
      const city =
        place.city ??
        cities.find((item) => address.includes(item.label))?.value ??
        '';
      const result = await getCityParking(city, place.location);
      if (request !== sequence) return;
      allParkingLots.value = result.lots.map((lot) => ({
        ...lot,
        price: getShortTermParkingFee(lot.price ?? ''),
        distance: distanceInMeters(place.location, lot.location),
      }));
      source.value = result.source;
      parkingNotice.value = result.notice;
      await adjustRange(request);
      if (request !== sequence || disposed || blocked.value) return;
      await loadTimes();
    } catch (error) {
      if (!disposed) handleApiError(error);
      if (request === sequence) {
        source.value = '無法取得';
        message.value = dialogMessage.value;
      }
    } finally {
      if (request === sequence) {
        loading.value = false;
        expanding.value = false;
      }
    }
  };
  let locationRequest: Promise<void> | undefined;
  const ensureOrigin = () => {
    if (origin.value) return Promise.resolve();
    locationRequest ??= new Promise<void>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!disposed && !blocked.value)
            origin.value = { lat: coords.latitude, lng: coords.longitude };
          resolve();
        },
        () => resolve(),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
    return locationRequest;
  };
  const search = async (query: string) => {
    if (loading.value || disposed || blocked.value) return;
    if (!mapsConfigured) {
      message.value = '請先依 README 設定 Google Maps API key。';
      return;
    }
    clearTimeout(searchTimer);
    searchQuery = query.trim();
    if (searchQuery.length < 2) {
      sequence += 1;
      suggestions.value = [];
      searching.value = false;
      searchMessage.value = '';
      return;
    }
    const request = ++sequence;
    searching.value = true;
    suggestions.value = [];
    searchMessage.value = '';
    try {
      await ensureOrigin();
      if (request !== sequence || disposed || blocked.value) return;
      const { AutocompleteSuggestion, AutocompleteSessionToken } =
        await loadMapsLibrary('places');
      if (request !== sequence) return;
      if (blocked.value) return;
      token ??= new AutocompleteSessionToken();
      const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: searchQuery,
        sessionToken: token,
        language: 'zh-TW',
        region: 'tw',
        includedRegionCodes: ['tw'],
        ...(origin.value
          ? {
              origin: origin.value,
              locationBias: { center: origin.value, radius: 50000 },
            }
          : {}),
      });
      if (request !== sequence || disposed || blocked.value) return;
      suggestions.value = result.suggestions
        .flatMap(({ placePrediction }) =>
          placePrediction
            ? [
                {
                  id: placePrediction.placeId,
                  name:
                    placePrediction.mainText?.toString() ??
                    placePrediction.text.toString(),
                  description: placePrediction.text.toString(),
                  address: placePrediction.secondaryText?.toString() ?? '',
                  distance:
                    Number.isFinite(placePrediction.distanceMeters) &&
                    (placePrediction.distanceMeters ?? 0) > 0
                      ? placePrediction.distanceMeters!
                      : null,
                  prediction: placePrediction,
                },
              ]
            : []
        )
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      if (!suggestions.value.length)
        searchMessage.value = '查無地點，請輸入更完整的台灣店名或地址。';
    } catch (error) {
      if (!disposed) handleApiError(error);
      if (request === sequence) searchMessage.value = dialogMessage.value;
    } finally {
      if (request === sequence) searching.value = false;
    }
  };
  const inputSearch = (query: string) => {
    if (loading.value || disposed || blocked.value) return;
    clearTimeout(searchTimer);
    sequence += 1;
    searchQuery = query.trim();
    searching.value = false;
    suggestions.value = [];
    searchMessage.value = '';
    if (searchQuery.length >= 2 && !loading.value)
      searchTimer = setTimeout(() => search(searchQuery), 400);
  };
  const chooseSuggestion = async (suggestion: SearchSuggestion) => {
    if (loading.value || blocked.value) return;
    clearTimeout(searchTimer);
    const request = ++sequence;
    searching.value = false;
    loading.value = true;
    message.value = '';
    suggestions.value = [];
    try {
      if (blocked.value) return;
      const place = suggestion.prediction.toPlace();
      token = undefined;
      // Essentials only: 不取 Pro 的 displayName 或 Enterprise 的 rating。
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'attributions'],
      });
      if (request !== sequence || disposed || blocked.value) return;
      if (!place.location) throw new Error('缺少地點座標');
      await loadNearby({
        kind: 'food',
        attributions: place.attributions?.map((item) => ({
          provider: item.provider ?? '',
          url: item.providerURI ?? '',
        })),
        id: place.id,
        name: suggestion.name,
        address: place.formattedAddress ?? suggestion.description,
        location: place.location.toJSON(),
        distance: 0,
      });
    } catch (error) {
      if (!disposed) handleApiError(error);
      if (request === sequence) message.value = dialogMessage.value;
    } finally {
      if (request === sequence) loading.value = false;
    }
  };
  const openSaved = async (saved: SavedPlace) => {
    if (loading.value || blocked.value || disposed) return;
    clearTimeout(searchTimer);
    const request = ++sequence;
    loading.value = true;
    suggestions.value = [];
    searching.value = false;
    try {
      await ensureOrigin();
      if (request !== sequence || blocked.value || disposed) return;
      if (saved.kind === 'food') {
        if (!mapsConfigured) {
          message.value = '請先設定 Google Maps API key。';
          return;
        }
        const { Place: GooglePlace } = await loadMapsLibrary('places');
        if (request !== sequence || blocked.value || disposed) return;
        loading.value = false;
        await chooseSuggestion({
          name: saved.name,
          description: saved.address,
          prediction: { toPlace: () => new GooglePlace({ id: saved.id }) },
        } as SearchSuggestion);
      } else {
        await loadNearby({
          kind: 'food',
          id: `saved-parking:${saved.id}`,
          name: saved.name,
          address: saved.address,
          location: saved.location,
          distance: 0,
        });
        const lot = parkingLots.value.find((item) => item.id === saved.id);
        if (lot) selected.value = lot;
      }
    } catch (error) {
      if (!disposed) handleApiError(error);
      message.value = dialogMessage.value;
    } finally {
      if (request === sequence) loading.value = false;
    }
  };
  const select = (place: Place) => {
    activeKind.value = place.kind;
    selected.value = place;
  };
  const switchKind = (kind: PlaceKind) => {
    activeKind.value = kind;
  };
  const locate = () => {
    if (loading.value || blocked.value) return;
    if (!navigator.geolocation) {
      message.value = '此瀏覽器不支援定位。';
      return;
    }
    clearTimeout(searchTimer);
    const request = ++sequence;
    searching.value = false;
    suggestions.value = [];
    loading.value = true;
    message.value = '取得目前位置中…';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== sequence) return;
        const location: Coordinates = {
          lat: coords.latitude,
          lng: coords.longitude,
        };
        origin.value = location;
        loadNearby({
          kind: 'food',
          id: 'current-location',
          name: '目前位置',
          address: '依裝置定位',
          location,
          distance: 0,
        });
      },
      () => {
        if (request !== sequence) return;
        loading.value = false;
        message.value = '無法取得位置，請允許定位或改用地點搜尋。';
      },
      { timeout: 10000 }
    );
  };
  const refresh = () => {
    if (destination.value && !loading.value && !blocked.value)
      loadNearby(destination.value);
  };
  return {
    radius,
    expanding,
    parkingTotal,
    parkingSort,
    openSaved,
    searching,
    origin,
    searchMessage,
    inputSearch,
    source,
    parkingNotice,
    activeKind,
    selected,
    destination,
    message,
    places,
    restaurants,
    parkingLots,
    suggestions,
    loading,
    mapsConfigured,
    search,
    chooseSuggestion,
    select,
    switchKind,
    locate,
    refresh,
  };
};

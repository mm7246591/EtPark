import { expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useExplore } from '../../../views/explore/composables/useExplore';

vi.mock('../../../composables/useApiUsage', () => ({
  useApiUsage: () => ({
    blocked: mocks.blocked,
    handleApiError: mocks.quotaError,
    dialogMessage: { value: '目前無法查詢，請稍後再試。' },
  }),
}));
vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  onBeforeUnmount: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mocks = vi.hoisted(() => ({
  blocked: { value: false },
  search: vi.fn(),
  fields: vi.fn(),
  parking: vi.fn(),
  quotaError: vi.fn(),
}));
vi.mock('../../../apis/googleMaps', () => ({
  mapsConfigured: true,
  loadMapsLibrary: async () => ({
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: mocks.search },
    AutocompleteSessionToken: class {},
  }),
}));
vi.mock('../../../apis/nationalParking', () => ({
  getCityParking: mocks.parking,
}));
it('直接查建議與 Essentials，不先呼叫用量 API，選定後依縣市查停車資料', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const place = {
    id: 'google-id',
    location: { toJSON: () => ({ lat: 25.0478, lng: 121.517 }) },
    formattedAddress: '台北市',
    fetchFields: mocks.fields,
  };
  const prediction = {
    placeId: 'google-id',
    mainText: { toString: () => '店家' },
    text: { toString: () => '台北市店家' },
    toPlace: () => place,
  };
  mocks.search.mockResolvedValue({
    suggestions: [{ placePrediction: prediction }],
  });
  mocks.fields.mockResolvedValue({ place });
  mocks.parking.mockResolvedValue({
    lots: [],
    source: '交通部 TDX',
    queriedAt: '',
    notice: '',
  });
  const explore = useExplore();
  expect(mocks.search).not.toHaveBeenCalled();
  await explore.search('店家');
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.search.mock.calls[0]?.[0].includedRegionCodes).toEqual(['tw']);
  expect(mocks.search.mock.calls[0]?.[0]).not.toHaveProperty(
    'locationRestriction'
  );
  expect(mocks.fields).not.toHaveBeenCalled();
  await explore.chooseSuggestion(explore.suggestions.value[0]!);
  expect(mocks.fields).toHaveBeenCalledWith({
    fields: ['location', 'formattedAddress', 'attributions'],
  });
  expect(mocks.parking).toHaveBeenCalledTimes(1);
  expect(mocks.parking).toHaveBeenCalledWith('Taipei', {
    lat: 25.0478,
    lng: 121.517,
  });
  expect(explore.restaurants.value[0]?.name).toBe('店家');
  expect(explore.loading.value).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('400ms 合併輸入、清空後忽略較舊回應，不額外呼叫店家詳細資料', async () => {
  vi.useFakeTimers();
  let resolve: (value: unknown) => void = () => {};
  mocks.search.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const explore = useExplore();
  explore.inputSearch('蛋');
  await vi.advanceTimersByTimeAsync(400);
  expect(mocks.search).not.toHaveBeenCalled();
  explore.inputSearch('蛋白');
  await vi.advanceTimersByTimeAsync(200);
  explore.inputSearch('蛋白盒子');
  await vi.advanceTimersByTimeAsync(399);
  expect(mocks.search).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.search.mock.calls[0]?.[0].input).toBe('蛋白盒子');
  expect(explore.loading.value).toBe(false);
  explore.inputSearch('');
  resolve({
    suggestions: [
      {
        placePrediction: { placeId: 'old', text: { toString: () => '舊結果' } },
      },
    ],
  });
  await Promise.resolve();
  expect(explore.suggestions.value).toEqual([]);
  expect(explore.searching.value).toBe(false);
  expect(mocks.fields).not.toHaveBeenCalled();
});
it('定位使用 origin 與 locationBias，候選由近到遠，缺距離不當成零', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (position: unknown) => void) =>
        success({ coords: { latitude: 25.03, longitude: 121.56 } }),
    },
  });
  mocks.search.mockResolvedValue({
    suggestions: [2000, undefined, 150, 0].map((distanceMeters, index) => ({
      placePrediction: {
        placeId: String(index),
        distanceMeters,
        mainText: { toString: () => `蛋白盒子${index}` },
        secondaryText: { toString: () => '台北市地址' },
        text: { toString: () => '完整描述' },
      },
    })),
  });
  const explore = useExplore();
  await explore.search('蛋白盒子');
  expect(mocks.search.mock.calls[0]?.[0].origin).toEqual({
    lat: 25.03,
    lng: 121.56,
  });
  expect(mocks.search.mock.calls[0]?.[0].locationBias.radius).toBe(50000);
  expect(explore.suggestions.value.map((item) => item.distance)).toEqual([
    150,
    2000,
    null,
    null,
  ]);
  expect(explore.suggestions.value[0]?.address).toBe('台北市地址');
  expect(mocks.fields).not.toHaveBeenCalled();
});

it('封鎖後搜尋與選店都不再呼叫 Google 或停車來源', async () => {
  mocks.blocked.value = true;
  try {
    const explore = useExplore();
    await explore.search('蛋白盒子');
    await explore.chooseSuggestion({} as never);
    explore.inputSearch('蛋白盒子');
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.fields).not.toHaveBeenCalled();
    expect(mocks.parking).not.toHaveBeenCalled();
  } finally {
    mocks.blocked.value = false;
  }
});

it('搜尋與店家詳情的 SDK 配額錯誤交給共用 dialog 處理', async () => {
  const error = Object.assign(new Error('Quota exhausted'), {
    code: 'RESOURCE_EXHAUSTED',
  });
  mocks.search.mockRejectedValueOnce(error);
  const explore = useExplore();
  await explore.search('店家');
  expect(mocks.quotaError).toHaveBeenCalledWith(error);
  mocks.fields.mockRejectedValueOnce(error);
  await explore.chooseSuggestion({
    prediction: { toPlace: () => ({ fetchFields: mocks.fields }) },
  } as never);
  expect(mocks.quotaError).toHaveBeenCalledTimes(2);
  expect(mocks.parking).not.toHaveBeenCalled();
});

it('首次搜尋自動請求定位，拒絕後仍搜尋且不重複請求定位', async () => {
  const geolocation = vi.fn((_success, failure) => failure({ code: 1 }));
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition: geolocation },
  });
  mocks.search.mockResolvedValue({ suggestions: [] });
  const explore = useExplore();
  await explore.search('店家');
  await explore.search('咖啡');
  expect(geolocation).toHaveBeenCalledTimes(1);
  expect(mocks.search).toHaveBeenCalledTimes(2);
  expect(mocks.search.mock.calls[0]?.[0]).not.toHaveProperty('origin');
  expect(explore.origin.value).toBeNull();
});

it('停車場有位優先、未知其次、滿位最後，各組由近到遠並排除一公里外', async () => {
  const center = { lat: 25.03, lng: 121.56 };
  const place = {
    id: 'destination',
    location: { toJSON: () => center },
    formattedAddress: '台北市',
    fetchFields: mocks.fields,
  };
  mocks.fields.mockResolvedValue({ place });
  mocks.parking.mockResolvedValue({
    lots: [
      ['full', 0, 0.0001],
      ['available-far', 20, 0.002],
      ['unknown', null, 0.0002],
      ['available-near', 1, 0.001],
      ['outside', 50, 0.02],
    ].map(([id, spaces, offset]) => ({
      id,
      spaces,
      location: { lat: center.lat + Number(offset), lng: center.lng },
    })),
    source: 'test',
    queriedAt: '',
    notice: '',
  });
  const explore = useExplore();
  await explore.chooseSuggestion({
    name: '店家',
    prediction: { toPlace: () => place },
  } as never);
  expect(explore.parkingLots.value.map((lot) => lot.id)).toEqual([
    'available-near',
    'available-far',
    'unknown',
    'full',
  ]);
});

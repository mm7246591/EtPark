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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.minutes.mockResolvedValue([]);
});
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
  minutes: vi.fn(),
}));
vi.mock('../../../apis/googleMaps', () => ({
  mapsConfigured: true,
  loadMapsLibrary: async () => ({
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: mocks.search },
    AutocompleteSessionToken: vi.fn(),
    Place: class {
      id: string;

      location = { toJSON: () => ({ lat: 25.03, lng: 121.56 }) };

      formattedAddress = '台北市最新地址';

      fetchFields = mocks.fields;

      constructor({ id }: { id: string }) {
        this.id = id;
      }
    },
  }),
}));
vi.mock('../../../apis/routes', () => ({ getDrivingMinutes: mocks.minutes }));
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

it('預設距離目的地由近到遠，排除滿位與一公里外', async () => {
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
    'unknown',
    'available-near',
    'available-far',
  ]);
});

it('定位後搜尋候選只取得店名地址，不查行車時間或詳細資料', async () => {
  const explore = useExplore();
  explore.origin.value = { lat: 25.03, lng: 121.56 };
  mocks.search.mockResolvedValue({
    suggestions: [
      {
        placePrediction: {
          placeId: 'branch',
          text: { toString: () => '分店' },
          distanceMeters: 200,
        },
      },
    ],
  });
  await explore.search('分店');
  expect(mocks.minutes).not.toHaveBeenCalled();
  expect(explore.suggestions.value[0]?.name).toBe('分店');
  expect(mocks.fields).not.toHaveBeenCalled();
});

it('停車時間從目前位置計算，失敗仍保留已取得的車位資訊', async () => {
  const explore = useExplore();
  explore.origin.value = { lat: 25.03, lng: 121.56 };
  const location = { lat: 25.04, lng: 121.56 };
  const lotLocation = { lat: 25.0401, lng: 121.56 };
  mocks.parking.mockResolvedValue({
    lots: [{ id: 'parking', spaces: 10, location: lotLocation }],
    source: '市府',
    notice: '',
  });
  mocks.minutes.mockResolvedValueOnce([3]);
  const suggestion = {
    name: '店家',
    prediction: {
      toPlace: () => ({
        id: 'store',
        fetchFields: mocks.fields,
        formattedAddress: '台北市',
        location: { toJSON: () => location },
      }),
    },
  };
  await explore.chooseSuggestion(suggestion as never);
  expect(mocks.minutes).toHaveBeenCalledWith(explore.origin.value, [
    lotLocation,
  ]);
  expect(explore.parkingLots.value[0]?.drivingMinutes).toBe(3);
  explore.origin.value = { lat: 25.02, lng: 121.56 };
  const error = new Error('network failed');
  mocks.minutes.mockRejectedValueOnce(error);
  await explore.chooseSuggestion(suggestion as never);
  expect(explore.source.value).toBe('市府');
  expect(explore.parkingLots.value[0]?.spaces).toBe(10);
  expect(mocks.quotaError).toHaveBeenCalledWith(error);
});

it('一公里有確定空位時不擴大，排序不再查 API', async () => {
  const explore = useExplore();
  const center = { lat: 25.03, lng: 121.56 };
  mocks.parking.mockResolvedValue({
    lots: [
      { id: 'near', spaces: 1, location: { lat: 25.031, lng: 121.56 } },
      { id: 'far', spaces: 20, location: { lat: 25.045, lng: 121.56 } },
      { id: 'full', spaces: 0, location: center },
    ],
    source: '市府',
    notice: '',
  });
  await explore.chooseSuggestion({
    name: '店家',
    prediction: {
      toPlace: () => ({
        id: 'store',
        fetchFields: mocks.fields,
        formattedAddress: '台北市',
        location: { toJSON: () => center },
      }),
    },
  } as never);
  expect(explore.parkingLots.value.map((lot) => lot.id)).toEqual(['near']);
  expect(explore.radius.value).toBe(1000);
  explore.parkingSort.value = ['spaces'];
  expect(explore.parkingLots.value.map((lot) => lot.id)).toEqual(['near']);
  expect(mocks.parking).toHaveBeenCalledTimes(1);
  expect(mocks.minutes).not.toHaveBeenCalled();
});

it('重開收藏停車場取得新車位，不把收藏資料當成即時狀態', async () => {
  const explore = useExplore();
  mocks.parking.mockResolvedValue({
    lots: [{ id: 'saved', spaces: 5, location: { lat: 25, lng: 121 } }],
    source: '市府',
    notice: '',
  });
  await explore.openSaved({
    id: 'saved',
    kind: 'parking',
    name: '停車場',
    address: '台北市',
    location: { lat: 25, lng: 121 },
    savedAt: Date.now(),
  });
  expect(mocks.parking).toHaveBeenCalledTimes(1);
  expect(explore.parkingLots.value[0]?.spaces).toBe(5);
  expect(explore.selected.value?.id).toBe('saved');
});

it('重新開啟收藏店家使用 place ID 取得最新地址再查車位', async () => {
  const explore = useExplore();
  mocks.fields.mockResolvedValue({});
  mocks.parking.mockResolvedValue({ lots: [], source: '市府', notice: '' });
  await explore.openSaved({
    id: 'store',
    kind: 'food',
    name: '收藏店家',
    address: '舊地址',
    location: { lat: 20, lng: 120 },
    savedAt: Date.now(),
  });
  expect(mocks.fields).toHaveBeenCalledWith({
    fields: ['location', 'formattedAddress', 'attributions'],
  });
  expect(explore.destination.value?.address).toBe('台北市最新地址');
  expect(mocks.parking).toHaveBeenCalledWith('Taipei', {
    lat: 25.03,
    lng: 121.56,
  });
});

it('自動擴大完成後只查一次最終清單時間，排序不重查時間', async () => {
  const explore = useExplore();
  const center = { lat: 25.03, lng: 121.56 };
  explore.origin.value = center;
  const near = { lat: 25.031, lng: 121.56 };
  const far = { lat: 25.045, lng: 121.56 };
  mocks.parking.mockResolvedValue({
    lots: [
      { id: 'near', spaces: null, location: near },
      { id: 'far', spaces: 20, location: far },
    ],
    source: '市府',
    notice: '',
  });
  mocks.minutes.mockResolvedValueOnce([3, 8]);
  await explore.chooseSuggestion({
    name: '店家',
    prediction: {
      toPlace: () => ({
        id: 'store',
        fetchFields: mocks.fields,
        formattedAddress: '台北市',
        location: { toJSON: () => center },
      }),
    },
  } as never);
  expect(mocks.minutes.mock.calls.map((call) => call[1])).toEqual([
    [near, far],
  ]);
  explore.parkingSort.value = ['distance'];
  expect(explore.parkingLots.value.map((lot) => lot.drivingMinutes)).toEqual([
    3, 8,
  ]);
  expect(mocks.parking).toHaveBeenCalledTimes(1);
  expect(mocks.minutes).toHaveBeenCalledTimes(1);
});

it.each([
  ['unknown', null, 0.015, 2000],
  ['full', 0, 0.023, 3000],
  ['empty', null, 0.04, 3000],
])(
  '一公里 %s 時自動逐步擴大至 %s，最多三公里並只查一次停車來源',
  async (_case, spaces, farOffset, expectedRadius) => {
    vi.useFakeTimers();
    const center = { lat: 25.03, lng: 121.56 };
    const explore = useExplore();
    mocks.parking.mockResolvedValue({
      lots: [
        { id: 'near', spaces, location: { lat: 25.031, lng: 121.56 } },
        {
          id: 'far',
          spaces: 20,
          location: { lat: center.lat + Number(farOffset), lng: center.lng },
        },
      ],
      source: '市府',
      notice: '',
    });
    const pending = explore.chooseSuggestion({
      name: '店家',
      prediction: {
        toPlace: () => ({
          id: 'store',
          fetchFields: mocks.fields,
          formattedAddress: '台北市',
          location: { toJSON: () => center },
        }),
      },
    } as never);
    await vi.advanceTimersByTimeAsync(1);
    expect(explore.expanding.value).toBe(true);
    expect(explore.radius.value).toBe(1000);
    await vi.advanceTimersByTimeAsync(499);
    expect(explore.radius.value).toBe(2000);
    await vi.advanceTimersByTimeAsync(500);
    await pending;
    expect(explore.radius.value).toBe(expectedRadius);
    expect(explore.loading.value).toBe(false);
    expect(explore.expanding.value).toBe(false);
    expect(mocks.parking).toHaveBeenCalledTimes(1);
  }
);

it('附近沒有停車資料時最多擴大到三公里，不重試 API 或產生假資料', async () => {
  vi.useFakeTimers();
  const center = { lat: 25.03, lng: 121.56 };
  const explore = useExplore();
  mocks.parking.mockResolvedValue({ lots: [], source: '市府', notice: '' });
  const pending = explore.chooseSuggestion({
    name: '店家',
    prediction: {
      toPlace: () => ({
        id: 'store',
        fetchFields: mocks.fields,
        formattedAddress: '台北市',
        location: { toJSON: () => center },
      }),
    },
  } as never);
  await vi.advanceTimersByTimeAsync(1000);
  await pending;
  expect(explore.radius.value).toBe(3000);
  expect(explore.parkingLots.value).toEqual([]);
  expect(mocks.parking).toHaveBeenCalledTimes(1);
  expect(mocks.minutes).not.toHaveBeenCalled();
});

import proj4 from 'proj4';

class ParkingRateLimitError extends Error {}
const maxResponseBytes = 5 * 1024 * 1024;

const cities = [
  'Taipei',
  'Taoyuan',
  'Taichung',
  'Tainan',
  'Kaohsiung',
  'Keelung',
  'Hsinchu',
  'HsinchuCounty',
  'MiaoliCounty',
  'ChanghuaCounty',
  'NantouCounty',
  'YunlinCounty',
  'ChiayiCounty',
  'Chiayi',
  'PingtungCounty',
  'YilanCounty',
  'HualienCounty',
  'TaitungCounty',
  'KinmenCounty',
  'PenghuCounty',
  'LienchiangCounty',
  'NewTaipei',
];
const availabilityCities = [
  'Taipei',
  'Taoyuan',
  'Taichung',
  'Tainan',
  'Kaohsiung',
  'Keelung',
  'ChanghuaCounty',
  'YunlinCounty',
  'PingtungCounty',
  'YilanCounty',
  'HualienCounty',
  'KinmenCounty',
];
const cache = new Map();
let token;
let tokenExpires = 0;
let tokenRequest;
const fetchJSON = async (url, options = {}) => {
  const tdx = url.startsWith('https://tdx.transportdata.tw/');
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (tdx && response.status === 429) {
    throw new ParkingRateLimitError('TDX rate limit exceeded');
  }
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  if (!tdx) return response.json();
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (bytes <= maxResponseBytes) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxResponseBytes) {
      // eslint-disable-next-line no-await-in-loop
      await reader.cancel();
      throw new Error('TDX response too large');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};
const cached = async (key, ttl, fetcher) => {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = fetcher().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { promise, expires: Date.now() + ttl });
  return promise;
};
const accessToken = async (env) => {
  if (token && tokenExpires > Date.now()) return token;
  tokenRequest ??= fetchJSON(
    'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.TDX_CLIENT_ID,
        client_secret: env.TDX_CLIENT_SECRET,
      }),
    }
  )
    .then((data) => {
      if (typeof data.access_token !== 'string' || !(data.expires_in > 60))
        throw new Error('Invalid token response');
      token = data.access_token;
      tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
      return token;
    })
    .finally(() => {
      tokenRequest = undefined;
    });
  return tokenRequest;
};
const readPages = async (pageURL, readItems, options) => {
  const rows = [];
  for (let page = 0; page < 30; page += 1) {
    // 分頁依序讀取，避免同時大量請求耗盡 TDX 配額。
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchJSON(pageURL(page), options);
    const items = readItems(data);
    if (!Array.isArray(items)) throw new Error('Invalid parking response');
    rows.push(...items);
    if (items.length < 1000) return rows;
  }
  throw new Error('Parking pagination limit exceeded');
};
const coordinates = (xValue, yValue) => {
  const x = Number(xValue);
  const y = Number(yValue);
  if (!(x > 0) || !(y > 0)) return null;
  const [lng, lat] = proj4(
    '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
    'EPSG:4326',
    [x, y]
  );
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};
const validSpaces = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};
const normalizeTDX = (description, available) => {
  const byId = new Map(available.map((item) => [item.CarParkID, item]));
  return description.flatMap((item) => {
    const location = {
      lat: item.CarParkPosition?.PositionLat,
      lng: item.CarParkPosition?.PositionLon,
    };
    if (
      !item.CarParkID ||
      item.IsMotorcycle === 1 ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng)
    )
      return [];
    const live = byId.get(item.CarParkID);
    const collected = Date.parse(live?.DataCollectTime ?? '');
    const fresh =
      Number.isFinite(collected) && Math.abs(Date.now() - collected) < 900000;
    // 僅使用自小客車位，不把所有車種總數當成汽車剩餘位。
    const car = live?.Availabilities?.find((entry) => entry.SpaceType === 1);
    return [
      {
        kind: 'parking',
        id: item.CarParkID,
        name: item.CarParkName?.Zh_tw || item.CarParkID,
        address: item.Address || '',
        location,
        distance: 0,
        price: item.FareDescription || '依現場公告',
        spaces:
          fresh &&
          live?.ServiceStatus === 1 &&
          item.LiveOccuppancyAvailable === 1
            ? validSpaces(car?.AvailableSpaces)
            : null,
      },
    ];
  });
};
const getCityParking = async (city, env) => {
  if (!cities.includes(city)) throw new Error('Invalid city');
  let source = '交通部 TDX';
  if (city === 'Taipei') source = '台北市停車管理工程處';
  if (city === 'NewTaipei') source = '新北市政府交通局';
  if (
    !['Taipei', 'NewTaipei'].includes(city) &&
    (!env.TDX_CLIENT_ID || !env.TDX_CLIENT_SECRET)
  ) {
    return {
      lots: [],
      source,
      queriedAt: '',
      notice:
        '此縣市需先設定 TDX_CLIENT_ID 與 TDX_CLIENT_SECRET，才能取得停車資料。',
    };
  }
  return cached(`city:${city}`, 60000, async () => {
    let lots;
    let notice = '';
    if (city === 'Taipei' || city === 'NewTaipei') {
      const ntpc = city === 'NewTaipei';
      const staticURL = ntpc
        ? 'https://data.ntpc.gov.tw/api/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68/json'
        : 'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json';
      const liveURL = ntpc
        ? 'https://data.ntpc.gov.tw/api/datasets/e09b35a5-a738-48cc-b0f5-570b67ad9c78/json'
        : 'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json';
      const readNTPC = (url) =>
        readPages(
          (page) => `${url}?page=${page}&size=1000`,
          (data) => data
        );
      const [desc, live] = await Promise.all([
        cached(staticURL, 300000, () =>
          ntpc ? readNTPC(staticURL) : fetchJSON(staticURL)
        ),
        (ntpc ? readNTPC(liveURL) : fetchJSON(liveURL)).catch((error) => {
          if (error instanceof ParkingRateLimitError) throw error;
          return null;
        }),
      ]);
      if (!live) notice = '剩餘車位暫時無法取得，位置與收費仍可查看。';
      const rows = ntpc ? desc : desc?.data?.park;
      if (!Array.isArray(rows)) throw new Error('Invalid parking descriptions');
      const updated = Date.parse(
        live?.data?.UPDATETIME?.replace(' CST ', ' GMT+0800 ') ?? ''
      );
      const fresh =
        ntpc ||
        (Number.isFinite(updated) && Math.abs(Date.now() - updated) < 900000);
      const spaces = new Map(
        (ntpc ? (live ?? []) : (live?.data?.park ?? [])).map((row) => [
          ntpc ? row.ID : row.id,
          ntpc ? row.AVAILABLECAR : row.availablecar,
        ])
      );
      lots = rows.flatMap((raw) => {
        const item = ntpc
          ? Object.fromEntries(
              Object.entries(raw).map(([key, value]) => [
                key.toLowerCase(),
                value,
              ])
            )
          : raw;
        const location = coordinates(item.tw97x, item.tw97y);
        if (!(Number(item.totalcar) > 0) || !location || !item.id || !item.name)
          return [];
        return [
          {
            kind: 'parking',
            id: item.id,
            name: item.name,
            address: item.address || '',
            location,
            distance: 0,
            price: item.payex || '依現場公告',
            spaces:
              fresh && (ntpc || item.type === '1')
                ? validSpaces(spaces.get(item.id))
                : null,
          },
        ];
      });
    } else {
      const bearer = await accessToken(env);
      const options = { headers: { Authorization: `Bearer ${bearer}` } };
      const readTDX = (type) =>
        readPages(
          (page) =>
            `https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/${type}/City/${city}?$format=JSON&$top=1000&$skip=${page * 1000}`,
          (data) =>
            type === 'CarPark' ? data.CarParks : data.ParkingAvailabilities,
          options
        );
      const [description, available] = await Promise.all([
        cached(`tdx-desc:${city}`, 300000, () => readTDX('CarPark')),
        availabilityCities.includes(city)
          ? readTDX('ParkingAvailability').catch((error) => {
              if (error instanceof ParkingRateLimitError) throw error;
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (!available) notice = '此縣市目前未取得即時車位資料，車位顯示未提供。';
      lots = normalizeTDX(description, available ?? []);
    }
    return { lots, source, queriedAt: new Date().toISOString(), notice };
  });
};
const handleNationalParking = async (request, response, env = process.env) => {
  const params = new URL(request.url, 'http://localhost').searchParams;
  let city = params.get('city');
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const byLocation =
    !city &&
    params.has('lat') &&
    params.has('lng') &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  if (request.method !== 'GET' || (!cities.includes(city) && !byLocation)) {
    response.writeHead(400).end();
    return;
  }
  try {
    if (byLocation) {
      const upstream = await fetch(
        `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lng}/${lat}/4326`,
        {
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!upstream.ok) throw new Error('County lookup unavailable');
      const xml = await upstream.text();
      const county = xml
        .match(/<ctyName>([^<]+)<\/ctyName>/)?.[1]
        ?.replaceAll('臺', '台');
      const names = [
        '台北市',
        '桃園市',
        '台中市',
        '台南市',
        '高雄市',
        '基隆市',
        '新竹市',
        '新竹縣',
        '苗栗縣',
        '彰化縣',
        '南投縣',
        '雲林縣',
        '嘉義縣',
        '嘉義市',
        '屏東縣',
        '宜蘭縣',
        '花蓮縣',
        '台東縣',
        '金門縣',
        '澎湖縣',
        '連江縣',
        '新北市',
      ];
      city = cities[names.indexOf(county)];
      if (!city) throw new Error('County not found');
    }
    const data = await getCityParking(city, env);
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(data));
  } catch (error) {
    const network =
      error.name === 'TimeoutError' ||
      (error instanceof TypeError && /fetch/i.test(error.message));
    // TDX 429 是每分鐘呼叫上限，稍候即可恢復，告知前端重試時間。
    if (error instanceof ParkingRateLimitError) {
      response.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      });
      response.end(JSON.stringify({ message: 'Parking rate limited' }));
      return;
    }
    response.writeHead(network ? 504 : 502, {
      'Content-Type': 'application/json',
    });
    response.end(JSON.stringify({ message: 'Parking source unavailable' }));
  }
};
export { cities, normalizeTDX, getCityParking, handleNationalParking };

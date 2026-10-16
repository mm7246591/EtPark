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
const fetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.text();
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
// 地方資料的更新時間多半未帶時區，依台灣時間解析，避免部署在 UTC 主機時誤判過期。
const freshTaipei = (value) => {
  const time = String(value ?? '');
  const updated = Date.parse(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(time) ? time : `${time}+08:00`
  );
  return Number.isFinite(updated) && Math.abs(Date.now() - updated) < 900000;
};
const inTaiwan = ({ lat, lng }) =>
  lat > 21 && lat < 26.5 && lng > 118 && lng < 122.5;
const meters = (a, b) => {
  const radian = Math.PI / 180;
  return (
    Math.hypot(
      (b.lng - a.lng) * radian * Math.cos(a.lat * radian),
      (b.lat - a.lat) * radian
    ) * 6371000
  );
};
// 總格數不分汽機車的來源，只能依名稱排除純機車場。
const motorcycleOnly = (name) => /機車/.test(name) && !/汽/.test(name);
const parkingLot = (id, name, address, location, price, spaces) => ({
  kind: 'parking',
  id: String(id),
  name: name || String(id),
  address: address || '',
  location,
  distance: 0,
  price: price && price !== 'null' ? price : '依現場公告',
  spaces,
});
// 地方資料偶有重複代碼，重複者加序號，避免前端 key 衝突。
const uniqueIds = (lots) => {
  const seen = new Map();
  return lots.map((lot) => {
    const count = (seen.get(lot.id) ?? 0) + 1;
    seen.set(lot.id, count);
    return count > 1 ? { ...lot, id: `${lot.id}-${count}` } : lot;
  });
};
// 新竹市費率混有機車與充電說明，只取汽車費率並統一「/H」為「/時」。
const hsinchuFee = (weekdays, holiday) => {
  const car = (text) =>
    text
      ?.match(/汽車[:：]\s*([^，,\r\n]+)/)?.[1]
      ?.trim()
      .replace(/\/H(?![a-z])/gi, '/時');
  const weekday = car(weekdays);
  const weekend = car(holiday);
  if (weekday && weekday === weekend) return `汽車：${weekday}`;
  return (
    [weekday && `平日汽車：${weekday}`, weekend && `假日汽車：${weekend}`]
      .filter(Boolean)
      .join('；') || '依現場公告'
  );
};
const normalizeHsinchu = (rows) => {
  if (!Array.isArray(rows)) throw new Error('Invalid parking response');
  return rows.flatMap((item) => {
    const location = {
      lat: Number(item.LATITUDE),
      lng: Number(item.LONGITUDE),
    };
    if (
      !item.PARKNO ||
      !(Number(item.TOTALQUANTITY) > 0) ||
      !(location.lat > 0) ||
      !(location.lng > 0)
    )
      return [];
    const fresh = freshTaipei(item.UPDATETIME);
    return [
      {
        kind: 'parking',
        id: item.PARKNO,
        name: item.PARKINGNAME || item.PARKNO,
        address: item.ADDRESS || '',
        location,
        distance: 0,
        price: hsinchuFee(item.WEEKDAYS, item.HOLIDAY),
        spaces: fresh ? validSpaces(item.FREEQUANTITY) : null,
      },
    ];
  });
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
        // 基本資料的 LiveOccuppancyAvailable 常未更新（桃園 125 場有即時資料只標 4 場），以即時資料本身判斷。
        spaces:
          fresh && live?.ServiceStatus === 1
            ? validSpaces(car?.AvailableSpaces)
            : null,
      },
    ];
  });
};
const decodeXML = (text) =>
  text.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, entity) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]
  );
const normalizeTaoyuan = (xml) => {
  const fresh = freshTaipei(
    xml.match(/<parkingLots[^>]*updatetime="([^"]+)"/)?.[1]
  );
  const rows = [...xml.matchAll(/<parkingLot>([\s\S]*?)<\/parkingLot>/g)].map(
    ([, body]) =>
      Object.fromEntries(
        [...body.matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(([, key, value]) => [
          key,
          decodeXML(value),
        ])
      )
  );
  if (!rows.length) throw new Error('Invalid parking response');
  return rows.flatMap((item) => {
    // 欄位名稱與慣例相反：wgsX 是緯度、wgsY 是經度。
    const location = { lat: Number(item.wgsX), lng: Number(item.wgsY) };
    // 總格數不分汽機車，純機車場依收費說明排除。
    const motorcycle =
      /機車/.test(item.payGuide) && !/汽車|小型車|小客車/.test(item.payGuide);
    if (
      !item.parkId ||
      !(Number(item.totalSpace) > 0) ||
      motorcycle ||
      !inTaiwan(location)
    )
      return [];
    return [
      parkingLot(
        item.parkId,
        item.parkName,
        `${item.areaName ?? ''}${item.address ?? ''}`,
        location,
        item.payGuide,
        fresh ? validSpaces(item.surplusSpace) : null
      ),
    ];
  });
};
const normalizeKeelung = (rows) => {
  if (!Array.isArray(rows)) throw new Error('Invalid parking response');
  return rows.flatMap((item) => {
    const location = { lat: Number(item.Lat), lng: Number(item.Lon) };
    if (
      !item.ParkID ||
      !(Number(item.TotalSpace) > 0) ||
      motorcycleOnly(item.ParkName) ||
      !inTaiwan(location)
    )
      return [];
    return [
      parkingLot(
        item.ParkID,
        item.ParkName,
        item.Address,
        location,
        item.PayGuide,
        freshTaipei(item.UpdateTime) ? validSpaces(item.AvailableCar) : null
      ),
    ];
  });
};
const sumFields = (item, keys) =>
  keys.reduce((total, key) => total + (Number(item[key]) || 0), 0);
const tainanLocation = (text) => {
  const [lat, lng] = String(text ?? '')
    .split(/\s*[,，]\s*/)
    .map(Number);
  return { lat, lng };
};
const tainanName = (name) =>
  String(name ?? '')
    .replace(/臺/g, '台')
    .replace(/\s/g, '');
// 台南基本資料分公有收費、公有免費、民營三份；即時車位另由 parkweb 提供，代碼系統不同。
const normalizeTainan = (paid, free, privately, live) => {
  if (![paid, free, privately].every(Array.isArray))
    throw new Error('Invalid parking response');
  const lots = (live ?? []).flatMap((item) => {
    const location = tainanLocation(item.lnglat);
    const car = sumFields(item, [
      'largeCar_total',
      'car_total',
      'carDis_total',
      'carWoman_total',
      'carGreen_total',
    ]);
    // parkweb 也收錄「智慧停車」路邊路段，只取路外停車場。
    if (
      item.typeName === '智慧停車' ||
      !item.code ||
      !(car > 0) ||
      !inTaiwan(location)
    )
      return [];
    return [
      parkingLot(
        item.code,
        item.name,
        item.address,
        location,
        item.chargeFee,
        freshTaipei(item.update_time) ? validSpaces(item.car) : null
      ),
    ];
  });
  const rows = [
    ...[...paid, ...free].map((item) => ({
      code: item['停車場代碼'],
      name: item['停車場名稱'],
      address: item['停車場地址'],
      location: tainanLocation(item['經緯度']),
      price: item['收費費率'],
      car: sumFields(item, [
        '一般大型車數量',
        '一般小型車數量',
        '身障者小型車數量',
        '婦幼者小型車數量',
        '綠能小型車數量',
      ]),
    })),
    ...privately.map((item) => ({
      code: item.code,
      name: item.name,
      address: item.address,
      location: tainanLocation(item.lnglat),
      price: item.chargeFee,
      car: sumFields(item, [
        'largeCarvalue',
        'carvalue',
        'carDisvalue',
        'carWomanvalue',
        'carGreenvalue',
      ]),
    })),
  ];
  rows.forEach((item) => {
    if (!item.name || !(item.car > 0) || !inTaiwan(item.location)) return;
    // 同名或 30 公尺內視為 parkweb 已收錄的同一場，只補上收費說明。
    const same = lots.find(
      (lot) =>
        tainanName(lot.name) === tainanName(item.name) ||
        meters(lot.location, item.location) <= 30
    );
    const lot = parkingLot(
      `${item.code}-${item.name}`,
      item.name,
      item.address,
      item.location,
      item.price,
      null
    );
    if (!same) lots.push(lot);
    else if (same.price === '依現場公告') same.price = lot.price;
  });
  return lots;
};
const normalizeKaohsiung = (data) => {
  const rows = data?.parkingLots;
  if (!Array.isArray(rows)) throw new Error('Invalid parking response');
  return rows.flatMap((item) => {
    const location = { lat: Number(item.lat), lng: Number(item.lng) };
    // 少數場只有總量、未分車種；-1、-2 代表沒有即時資料，來源也沒有更新時間。
    const car =
      item.volumnAuto == null &&
      item.volumnTruck == null &&
      item.volumnScooter == null
        ? Number(item.volumn)
        : sumFields(item, ['volumnAuto', 'volumnTruck']);
    if (!item.areaid || !(car > 0) || !inTaiwan(location)) return [];
    return [
      parkingLot(
        item.areaid,
        item.name,
        `${item.areaname ?? ''}${item.location ?? ''}`,
        location,
        item.chargeway,
        validSpaces(item.smallcarVacancy)
      ),
    ];
  });
};
const normalizeYilan = (rows) => {
  if (!Array.isArray(rows)) throw new Error('Invalid parking response');
  return rows.flatMap((item) => {
    const location = { lat: Number(item.Y), lng: Number(item.X) };
    if (item.ID == null || !(Number(item.TotalCar) > 0) || !inTaiwan(location))
      return [];
    return [
      parkingLot(
        item.ID,
        item.CName,
        item.CAddress,
        location,
        item.PayEX,
        freshTaipei(item.Updatetime) ? validSpaces(item.AvailableCar) : null
      ),
    ];
  });
};
// 花蓮交通 e 點通把停車場 JSON 內嵌在頁面 script，沒有獨立 API。
const normalizeHualien = (html) => {
  const raw = html.match(/var parkingLots = JSON\.parse\('([\s\S]*?)'\);/)?.[1];
  const rows = raw && JSON.parse(raw.replace(/\\'/g, "'"));
  if (!Array.isArray(rows)) throw new Error('Invalid parking response');
  // 動態場（UID A 開頭）有即時車位，靜態清單也重複收錄其中幾場，先放動態場再以名稱去重。
  const dynamic = (item) => String(item.UID).startsWith('A');
  const names = new Set();
  return [...rows.filter(dynamic), ...rows.filter((item) => !dynamic(item))]
    .filter((item) => !names.has(item.Name) && names.add(item.Name))
    .flatMap((item) => {
      const location = {
        lat: Number(item.Latitude),
        lng: Number(item.Longitude),
      };
      const car = dynamic(item)
        ? Number(item.TotalQuantity)
        : sumFields(item, ['SmallCarQuantity', 'BigCarQuantity']);
      if (
        !item.UID ||
        !(car > 0) ||
        motorcycleOnly(item.Name) ||
        !inTaiwan(location)
      )
        return [];
      return [
        parkingLot(
          item.UID,
          item.Name,
          item.Address,
          location,
          item.TollType,
          // 來源沒有更新時間；圖示為 no source 代表該場沒有即時資料。
          dynamic(item) && !String(item.PinImgUrl).includes('no source')
            ? validSpaces(item.CurrentQunatity)
            : null
        ),
      ];
    });
};
// 嘉義市智慧停車平臺把停車場寫成頁面 script 內的 JS 物件陣列（非 JSON），逐欄擷取。
const normalizeChiayi = (html) => {
  const list = html.match(/var parkings\s*=\s*\[([\s\S]*?)\];/)?.[1];
  if (!list) throw new Error('Invalid parking response');
  return list
    .split(/\{\s*id\s*:/)
    .slice(1)
    .flatMap((chunk) => {
      const text = (key) =>
        chunk.match(new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`))?.[1];
      const number = (key) =>
        Number(chunk.match(new RegExp(`\\b${key}\\s*:\\s*(-?[\\d.]+)`))?.[1]);
      const id = chunk.match(/^\s*(\d+)/)?.[1];
      const location = { lat: number('lat'), lng: number('lng') };
      if (
        !id ||
        !(Number(text('totalspaces')) > 0) ||
        motorcycleOnly(text('name')) ||
        !inTaiwan(location)
      )
        return [];
      return [
        parkingLot(
          id,
          text('name'),
          text('addr'),
          location,
          text('remark'),
          validSpaces(text('availablespaces'))
        ),
      ];
    });
};
const liveUnavailable = '剩餘車位暫時無法取得，位置與收費仍可查看。';
const readTaipei = async (ntpc) => {
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
  const lots = rows.flatMap((raw) => {
    const item = ntpc
      ? Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value])
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
  return { lots, notice: live ? '' : liveUnavailable };
};
const readTDXCity = async (city, env) => {
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
  return {
    lots: normalizeTDX(description, available ?? []),
    notice: available ? '' : '此縣市目前未取得即時車位資料，車位顯示未提供。',
  };
};
const tainanDataset = (id) =>
  cached(`tainan:${id}`, 300000, async () => {
    const data = await fetchJSON(
      `https://soa.tainan.gov.tw/Api/Service/Get/${id}`
    );
    return data?.data;
  });
// TDX 漏收或缺即時車位的縣市改用地方政府資料，抓取失敗時退回 TDX。
const localSources = {
  Taipei: { source: '台北市停車管理工程處', read: () => readTaipei(false) },
  NewTaipei: { source: '新北市政府交通局', read: () => readTaipei(true) },
  // TDX 新竹市沒有即時車位且停車場較少。
  Hsinchu: {
    source: '新竹市政府交通處',
    read: async () => ({
      lots: normalizeHsinchu(
        await fetchJSON('https://hispark.hccg.gov.tw/OpenData/GetParkInfo')
      ),
    }),
  },
  // TDX 基隆市停車場基本資料是 0 筆；token 是市府即時交通網前端公開內建的匿名 token。
  Keelung: {
    source: '基隆市政府交通處',
    read: async () => ({
      lots: normalizeKeelung(
        await fetchJSON(
          'https://e-traffic.klcg.gov.tw/cptapi/another/api/ParkingRemainingInfo?$format=json&$token=FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'
        )
      ),
    }),
  },
  // TDX 桃園只收約六成停車場，且多數即時車位未標示可用。
  Taoyuan: {
    source: '桃園市政府交通局',
    read: async () => ({
      lots: normalizeTaoyuan(
        await fetchText(
          'https://opendata.tycg.gov.tw/api/dataset/f4cc0b12-86ac-40f9-8745-885bddc18f79/resource/0daad6e6-0632-44f5-bd25-5e1de1e9146f/download'
        )
      ),
    }),
  },
  // TDX 台南只收約一成五停車場。
  Tainan: {
    source: '台南市政府交通局',
    read: async () => {
      const [paid, free, privately, live] = await Promise.all([
        tainanDataset('24b8d897-7971-45f9-8489-b4918ee41ed7'),
        tainanDataset('d7349de7-2260-436f-afcb-6699373f0460'),
        tainanDataset('3d9abc60-8192-4e8a-9c75-3d14ec979ddf'),
        fetchJSON('https://parkweb.tainan.gov.tw/api/parking.php').catch(
          () => null
        ),
      ]);
      return {
        lots: normalizeTainan(
          paid,
          free,
          privately,
          Array.isArray(live) ? live : null
        ),
        notice: Array.isArray(live) ? '' : liveUnavailable,
      };
    },
  },
  // 以下為縣市府網站背後的端點，不是正式開放資料，改版時會退回 TDX。
  Kaohsiung: {
    source: '高雄市政府交通局',
    read: async () => ({
      lots: normalizeKaohsiung(
        await fetchJSON(
          'https://kpp.tbkc.gov.tw/ParkingLocation/ParkingLotPost',
          { method: 'POST', body: '' }
        )
      ),
    }),
  },
  YilanCounty: {
    source: '宜蘭縣政府交通處',
    read: async () => ({
      // 座標只用來排序距離，任何座標都回傳全縣資料。
      lots: normalizeYilan(
        await fetchJSON(
          'https://tp.e-land.gov.tw/ATIS/api/ParkingAPI/GetNestDetailAll?lat=24.754993&lng=121.758201'
        )
      ),
    }),
  },
  HualienCounty: {
    source: '花蓮縣政府',
    read: async () => ({
      lots: normalizeHualien(
        await fetchText('https://traffic.hl.gov.tw/Home/_TGOSMapPartialView', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'typeForAction=3',
        })
      ),
    }),
  },
  Chiayi: {
    source: '嘉義市政府交通處',
    read: async () => ({
      lots: normalizeChiayi(
        await fetchText('https://iparking.chiayi.gov.tw/car/open/map')
      ),
    }),
  },
};
const getCityParking = async (city, env) => {
  if (!cities.includes(city)) throw new Error('Invalid city');
  const local = localSources[city];
  const tdxReady = Boolean(env.TDX_CLIENT_ID && env.TDX_CLIENT_SECRET);
  if (!local && !tdxReady) {
    return {
      lots: [],
      source: '交通部 TDX',
      queriedAt: '',
      notice:
        '此縣市需先設定 TDX_CLIENT_ID 與 TDX_CLIENT_SECRET，才能取得停車資料。',
    };
  }
  return cached(`city:${city}`, 60000, async () => {
    if (local) {
      try {
        const { lots, notice = '' } = await local.read();
        return {
          lots: uniqueIds(lots),
          source: local.source,
          queriedAt: new Date().toISOString(),
          notice,
        };
      } catch (error) {
        if (error instanceof ParkingRateLimitError || !tdxReady) throw error;
      }
    }
    const { lots, notice } = await readTDXCity(city, env);
    return {
      lots,
      source: '交通部 TDX',
      queriedAt: new Date().toISOString(),
      notice,
    };
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
export {
  cities,
  normalizeTDX,
  normalizeHsinchu,
  normalizeTaoyuan,
  normalizeKeelung,
  normalizeTainan,
  normalizeKaohsiung,
  normalizeYilan,
  normalizeHualien,
  normalizeChiayi,
  getCityParking,
  handleNationalParking,
};

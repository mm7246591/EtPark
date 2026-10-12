import { expect, it } from 'vitest';
import {
  normalizeTDX,
  normalizeHsinchu,
  getCityParking,
  handleNationalParking,
} from './national-parking.mjs';

it('TDX 只配對小客車位，過期及未營業顯示未知', () => {
  const desc = [
    {
      CarParkID: '1',
      CarParkName: { Zh_tw: '停車場' },
      Address: '台中市',
      CarParkPosition: { PositionLat: 24.1, PositionLon: 120.6 },
      LiveOccuppancyAvailable: 1,
    },
  ];
  const live = {
    CarParkID: '1',
    DataCollectTime: new Date().toISOString(),
    ServiceStatus: 1,
    AvailableSpaces: 50,
    Availabilities: [
      { SpaceType: 1, AvailableSpaces: 0 },
      { SpaceType: 2, AvailableSpaces: 50 },
    ],
  };
  expect(normalizeTDX(desc, [live])[0]?.spaces).toBe(0);
  expect(
    normalizeTDX(desc, [{ ...live, Availabilities: null }])[0]?.spaces
  ).toBeNull();
  expect(
    normalizeTDX(desc, [{ ...live, DataCollectTime: '2020-01-01' }])[0]?.spaces
  ).toBeNull();
  expect(
    normalizeTDX(desc, [{ ...live, ServiceStatus: 0 }])[0]?.spaces
  ).toBeNull();
});
it('缺 TDX key 時回傳設定提示，不冒充查無停車場', async () => {
  const result = await getCityParking('Taichung', {});
  expect(result.lots).toEqual([]);
  expect(result.notice).toContain('TDX_CLIENT_ID');
  await expect(getCityParking('InvalidCity', {})).rejects.toThrow(
    'Invalid city'
  );
});

it('依 TDX 實際包裝欄位讀取停車場與車位', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    let data;
    if (String(url).includes('api.nlsc.gov.tw'))
      return new Response(
        '<townVillageItem><ctyName>臺中市</ctyName></townVillageItem>'
      );
    if (String(url).includes('/token'))
      data = { access_token: 'test-token', expires_in: 3600 };
    else if (String(url).includes('/ParkingAvailability/'))
      data = {
        ParkingAvailabilities: [
          {
            CarParkID: 'test',
            ServiceStatus: 1,
            DataCollectTime: new Date().toISOString(),
            Availabilities: [{ SpaceType: 1, AvailableSpaces: 8 }],
          },
        ],
      };
    else
      data = {
        CarParks: [
          {
            CarParkID: 'test',
            CarParkName: { Zh_tw: '測試停車場' },
            CarParkPosition: { PositionLat: 24.15, PositionLon: 120.67 },
            LiveOccuppancyAvailable: 1,
          },
        ],
      };
    return new Response(JSON.stringify(data));
  };
  try {
    const result = await getCityParking('Taichung', {
      TDX_CLIENT_ID: 'test',
      TDX_CLIENT_SECRET: 'test',
    });
    expect(result.lots[0]?.spaces).toBe(8);
    let status;
    let body;
    const response = {
      writeHead: (code) => {
        status = code;
        return response;
      },
      end: (value) => {
        body = value;
      },
    };
    await handleNationalParking(
      { method: 'GET', url: '/api/parking/city?city=&lat=24.15&lng=120.67' },
      response,
      { TDX_CLIENT_ID: 'test', TDX_CLIENT_SECRET: 'test' }
    );
    expect(status).toBe(200);
    expect(JSON.parse(body).lots[0].spaces).toBe(8);
    await handleNationalParking(
      { method: 'GET', url: '/api/parking/city?lat=999&lng=120.67' },
      response,
      { TDX_CLIENT_ID: 'test', TDX_CLIENT_SECRET: 'test' }
    );
    expect(status).toBe(400);
  } finally {
    globalThis.fetch = original;
  }
});

it('TDX 每分鐘上限回傳 429 與重試秒數，不需要本機用量保護設定', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let status;
  let headers;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('API rate limit exceeded', { status: 429 });
  };
  const response = {
    writeHead: (code, values) => {
      status = code;
      headers = values;
      return response;
    },
    end: () => {},
  };
  try {
    await handleNationalParking(
      { method: 'GET', url: '/api/parking/city?city=Taoyuan' },
      response,
      { TDX_CLIENT_ID: 'test', TDX_CLIENT_SECRET: 'test' }
    );
    expect(status).toBe(429);
    expect(headers['Retry-After']).toBe('60');
    expect(calls).toBeGreaterThan(0);
  } finally {
    globalThis.fetch = original;
  }
});

it('新竹市使用市府資料：只取汽車費率、排除機車場，台灣時間判斷是否過期', () => {
  const taipeiTime = (offset) =>
    new Date(Date.now() + 8 * 3600000 - offset).toISOString().replace('Z', '');
  const lots = normalizeHsinchu([
    {
      PARKNO: '004',
      PARKINGNAME: '府後地下停車場',
      ADDRESS: '新竹市北區府後街42號',
      WEEKDAYS: '汽車：20元/H，機車：20元/次',
      HOLIDAY: '汽車：20元/H\r\n  充電設備資訊：AC交流慢充',
      FREEQUANTITY: 33,
      TOTALQUANTITY: 287,
      LONGITUDE: '120.969783',
      LATITUDE: '24.80726',
      UPDATETIME: taipeiTime(60000),
    },
    {
      PARKNO: '020',
      PARKINGNAME: '遠東巨城購物中心停車場',
      WEEKDAYS: '汽車：30元/H，機車：免費',
      HOLIDAY: '汽車：60元/H，機車：免費',
      FREEQUANTITY: 1306,
      TOTALQUANTITY: 3000,
      LONGITUDE: '120.974726',
      LATITUDE: '24.809487',
      UPDATETIME: taipeiTime(3600000),
    },
    {
      PARKNO: 'M1',
      PARKINGNAME: '機車停車場',
      TOTALQUANTITY: 0,
      LONGITUDE: '120.97',
      LATITUDE: '24.8',
    },
  ]);
  expect(lots.map((lot) => lot.id)).toEqual(['004', '020']);
  expect(lots[0]).toMatchObject({
    price: '汽車：20元/時',
    spaces: 33,
    location: { lat: 24.80726, lng: 120.969783 },
  });
  expect(lots[1]).toMatchObject({
    price: '平日汽車：30元/時；假日汽車：60元/時',
    spaces: null,
  });
});

it('新竹市不需要 TDX key 即可取得停車資料', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(
      JSON.stringify([
        {
          PARKNO: '029',
          PARKINGNAME: '研發二路立體停車場',
          WEEKDAYS: '汽車：30元/H',
          HOLIDAY: '汽車：30元/H',
          FREEQUANTITY: 146,
          TOTALQUANTITY: 429,
          LONGITUDE: '121.001092',
          LATITUDE: '24.7774165',
          UPDATETIME: new Date().toISOString(),
        },
      ])
    );
  };
  try {
    const result = await getCityParking('Hsinchu', {});
    expect(result.source).toBe('新竹市政府交通處');
    expect(result.lots[0]).toMatchObject({ id: '029', spaces: 146 });
    expect(urls.every((url) => url.includes('hispark.hccg.gov.tw'))).toBe(true);
  } finally {
    globalThis.fetch = original;
  }
});

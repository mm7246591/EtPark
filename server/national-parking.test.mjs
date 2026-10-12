import { expect, it } from 'vitest';
import {
  normalizeTDX,
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

it('TDX 來源拒絕配額時回傳 429，不需要本機用量保護設定', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let status;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('API rate limit exceeded', { status: 429 });
  };
  const response = {
    writeHead: (code) => {
      status = code;
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
    expect(calls).toBeGreaterThan(0);
  } finally {
    globalThis.fetch = original;
  }
});

import { expect, it } from 'vitest';
import {
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
} from './national-parking.mjs';

const taipeiTime = (offset = 0) =>
  new Date(Date.now() + 8 * 3600000 - offset)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

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
  // LiveOccuppancyAvailable 常未更新，有即時資料就顯示。
  expect(
    normalizeTDX([{ ...desc[0], LiveOccuppancyAvailable: 0 }], [live])[0]
      ?.spaces
  ).toBe(0);
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
      { method: 'GET', url: '/api/parking/city?city=MiaoliCounty' },
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

it('各縣市地方資料：排除純機車場、座標欄位對調、過期或無資料時車位顯示未知', () => {
  const ids = (lots) => lots.map((lot) => lot.id);
  const taoyuan = normalizeTaoyuan(
    `<?xml version="1.0"?><parkingLots updatetime="${taipeiTime(60000)}"><parkingLot><wgsY>121.2985</wgsY><wgsX>24.959</wgsX><address>廣福路42號</address><parkName>大湳公有停車場&amp;A</parkName><areaName>八德區</areaName><totalSpace>165</totalSpace><payGuide>小型車-臨停:40/時</payGuide><parkId>P-BD-001</parkId><surplusSpace>22</surplusSpace></parkingLot><parkingLot><wgsY>121.3</wgsY><wgsX>24.9</wgsX><parkName>機車場</parkName><totalSpace>80</totalSpace><payGuide>機車-臨停:20/次</payGuide><parkId>P-JL-041</parkId><surplusSpace>開放中</surplusSpace></parkingLot></parkingLots>`
  );
  expect(taoyuan).toEqual([
    expect.objectContaining({
      id: 'P-BD-001',
      name: '大湳公有停車場&A',
      address: '八德區廣福路42號',
      location: { lat: 24.959, lng: 121.2985 },
      spaces: 22,
    }),
  ]);

  const keelung = normalizeKeelung([
    {
      ParkID: 'K1',
      ParkName: '東岸',
      TotalSpace: '666',
      Lat: 25.13,
      Lon: 121.74,
      AvailableCar: 203,
      UpdateTime: taipeiTime(60000),
    },
    {
      ParkID: 'K2',
      ParkName: '舊站',
      TotalSpace: '50',
      Lat: 25.13,
      Lon: 121.74,
      AvailableCar: -99,
      UpdateTime: taipeiTime(60000),
    },
    {
      ParkID: 'K3',
      ParkName: '過期',
      TotalSpace: '50',
      Lat: 25.13,
      Lon: 121.74,
      AvailableCar: 9,
      UpdateTime: '2022-03-01 10:00:00',
    },
    {
      ParkID: 'K4',
      ParkName: '機車停車場',
      TotalSpace: '50',
      Lat: 25.13,
      Lon: 121.74,
      AvailableCar: 9,
      UpdateTime: taipeiTime(60000),
    },
  ]);
  expect(keelung.map((lot) => [lot.id, lot.spaces])).toEqual([
    ['K1', 203],
    ['K2', null],
    ['K3', null],
  ]);

  const tainan = normalizeTainan(
    [
      {
        停車場代碼: '109',
        停車場名稱: '臺南 海安路停車場',
        經緯度: '22.9915，120.1956',
        收費費率: '30/半小時',
        一般小型車數量: '40',
      },
    ],
    [
      {
        停車場代碼: '0000',
        停車場名稱: '免費停車場',
        經緯度: '22.98，120.21',
        收費費率: 'null',
        一般小型車數量: '20',
      },
    ],
    [
      {
        code: '106',
        name: '民營停車場',
        lnglat: '22.97，120.22',
        chargeFee: '40/時',
        carvalue: '0',
      },
    ],
    [
      {
        typeName: '公有收費停車場',
        code: 'B00001',
        name: '台南海安路停車場',
        lnglat: '22.991501,120.195621',
        car_total: 909,
        car: 343,
        chargeFee: '',
        update_time: taipeiTime(60000),
      },
      {
        typeName: '智慧停車',
        code: 'R1',
        name: '路段',
        lnglat: '22.99,120.2',
        car_total: 30,
        car: 3,
        update_time: taipeiTime(60000),
      },
    ]
  );
  expect(tainan.map((lot) => [lot.id, lot.spaces, lot.price])).toEqual([
    ['B00001', 343, '30/半小時'],
    ['0000-免費停車場', null, '依現場公告'],
  ]);

  const kaohsiung = normalizeKaohsiung({
    parkingLots: [
      {
        areaid: 'KHB1',
        name: '華泰',
        areaname: '鼓山區',
        location: '華泰路',
        lat: '22.67',
        lng: '120.29',
        volumnAuto: '22',
        smallcarVacancy: '5',
      },
      {
        areaid: 'KHB2',
        name: '無即時',
        lat: '22.67',
        lng: '120.29',
        volumn: '10',
        volumnAuto: null,
        volumnTruck: null,
        volumnScooter: null,
        smallcarVacancy: '-2',
      },
      {
        areaid: 'KHB3',
        name: '機車',
        lat: '22.67',
        lng: '120.29',
        volumn: '80',
        volumnScooter: '80',
        smallcarVacancy: '-1',
      },
      {
        areaid: 'KHB4',
        name: '對調',
        lat: '120.29',
        lng: '22.67',
        volumnAuto: '22',
        smallcarVacancy: '5',
      },
    ],
  });
  expect(kaohsiung.map((lot) => [lot.id, lot.address, lot.spaces])).toEqual([
    ['KHB1', '鼓山區華泰路', 5],
    ['KHB2', '', null],
  ]);

  expect(
    normalizeYilan([
      {
        ID: 1,
        CName: '光復',
        TotalCar: 5,
        AvailableCar: 3,
        Updatetime: taipeiTime(60000).replace(' ', 'T'),
        X: 121.75,
        Y: 24.75,
      },
      {
        ID: 2,
        CName: '過期',
        TotalCar: 5,
        AvailableCar: 3,
        Updatetime: '2024-07-26T14:08:40.04',
        X: 121.75,
        Y: 24.75,
      },
      {
        ID: 3,
        CName: '機車',
        TotalCar: 0,
        AvailableCar: 3,
        X: 121.75,
        Y: 24.75,
      },
    ]).map((lot) => [lot.id, lot.spaces])
  ).toEqual([
    ['1', 3],
    ['2', null],
  ]);

  const hualien = normalizeHualien(
    `<script>var parkingLots = JSON.parse('${JSON.stringify([
      {
        UID: 'HLP001',
        Name: 'TIMES 三民街',
        SmallCarQuantity: '83',
        Latitude: 23.97,
        Longitude: 121.61,
        CurrentQunatity: 0,
      },
      {
        UID: 'A0001',
        Name: 'TIMES 三民街',
        TotalQuantity: '130',
        TollType: '80元/時',
        Latitude: 23.97,
        Longitude: 121.61,
        CurrentQunatity: 48,
        PinImgUrl: 'Parking-plenty.png',
      },
      {
        UID: 'A0002',
        Name: '無來源',
        TotalQuantity: '50',
        Latitude: 23.97,
        Longitude: 121.61,
        CurrentQunatity: 0,
        PinImgUrl: 'Parking-no source.png',
      },
      {
        UID: 'HLP002',
        Name: '大同路',
        SmallCarQuantity: '83',
        BigCarQuantity: '0',
        Latitude: 23.33,
        Longitude: 121.31,
        CurrentQunatity: 0,
      },
    ]).replace(/'/g, "\\'")}');</script>`
  );
  expect(hualien.map((lot) => [lot.id, lot.spaces])).toEqual([
    ['A0001', 48],
    ['A0002', null],
    ['HLP002', null],
  ]);

  const chiayi = normalizeChiayi(`<script>
      var parkings=[
        {id:109,name:'西市場大樓停車場',lat:23.4793,lng: 120.4484 ,mapurl:'https://maps.app.goo.gl/x'
        ,status:'yellow',availablespaces:'30',totalspaces:'133'
        ,addr:'嘉義市西區國華街245號',tel:'02',remark:'平日：10元/0.5hr'},
        {id:5,name:'機車停車場',lat:23.47,lng:120.44,mapurl:'',status:'red',availablespaces:'3',totalspaces:'50',addr:'',tel:'',remark:''},
      ];</script>`);
  expect(chiayi).toEqual([
    expect.objectContaining({
      id: '109',
      address: '嘉義市西區國華街245號',
      location: { lat: 23.4793, lng: 120.4484 },
      price: '平日：10元/0.5hr',
      spaces: 30,
    }),
  ]);
  expect(ids(keelung)).not.toContain('K4');
});

it('地方資料抓取失敗時退回 TDX', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('kpp.tbkc.gov.tw'))
      return new Response('', { status: 500 });
    if (String(url).includes('/token'))
      return new Response(
        JSON.stringify({ access_token: 'test-token', expires_in: 3600 })
      );
    if (String(url).includes('/ParkingAvailability/'))
      return new Response(JSON.stringify({ ParkingAvailabilities: [] }));
    return new Response(
      JSON.stringify({
        CarParks: [
          {
            CarParkID: 'KHA1',
            CarParkName: { Zh_tw: 'TDX 停車場' },
            CarParkPosition: { PositionLat: 22.6, PositionLon: 120.3 },
          },
        ],
      })
    );
  };
  try {
    const result = await getCityParking('Kaohsiung', {
      TDX_CLIENT_ID: 'test',
      TDX_CLIENT_SECRET: 'test',
    });
    expect(result.source).toBe('交通部 TDX');
    expect(result.lots[0]?.id).toBe('KHA1');
  } finally {
    globalThis.fetch = original;
  }
});

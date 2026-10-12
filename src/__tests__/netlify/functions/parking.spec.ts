import { beforeEach, expect, it, vi } from 'vitest';
import handler from '../../../../netlify/functions/parking.mjs';

const parking = vi.hoisted(() => vi.fn());
vi.mock('../../../../server/national-parking.mjs', () => ({
  handleNationalParking: parking,
}));
beforeEach(() => {
  parking.mockReset();
});
it('Netlify 轉接保留查詢參數，回傳既有停車 API 的 JSON 與標頭', async () => {
  parking.mockImplementation(async (request, response) => {
    expect(new URL(request.url).searchParams.get('city')).toBe('NewTaipei');
    expect(new URL(request.url).searchParams.get('lat')).toBe('25.05');
    expect(request.method).toBe('GET');
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ lots: [], source: '新北市' }));
  });
  const result = await handler(
    new Request(
      'https://etpark.netlify.app/api/parking/city?city=NewTaipei&lat=25.05'
    )
  );
  expect(result.status).toBe(200);
  expect(result.headers.get('Cache-Control')).toBe('no-store');
  expect(await result.json()).toEqual({ lots: [], source: '新北市' });
});
it('來源的 429 不變成 200，保留前端配額提示行為', async () => {
  parking.mockImplementation(async (_request, response) =>
    response
      .writeHead(429, { 'Content-Type': 'application/json' })
      .end('{"message":"quota"}')
  );
  const result = await handler(
    new Request('https://etpark.netlify.app/api/parking/city?city=Taipei')
  );
  expect(result.status).toBe(429);
});

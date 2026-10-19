import { beforeEach, afterEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10000);
});
afterEach(() => vi.useRealTimers());

it('同一秒允許五次，第六次拒絕且不延長封鎖，一秒後可重試', async () => {
  const { assertApiRequestAllowed } = await import('../../utils/apiRateLimit');
  for (let index = 0; index < 5; index += 1) assertApiRequestAllowed();
  expect(assertApiRequestAllowed).toThrow('API_RATE_LIMITED');
  vi.setSystemTime(10999);
  expect(assertApiRequestAllowed).toThrow('API_RATE_LIMITED');
  vi.setSystemTime(11000);
  expect(assertApiRequestAllowed).not.toThrow();
});

it('不同 API 呼叫共用滑動時間窗，不因跨整秒便放行', async () => {
  const first = await import('../../utils/apiRateLimit');
  for (let index = 0; index < 3; index += 1) first.assertApiRequestAllowed();
  vi.setSystemTime(10500);
  const second = await import('../../utils/apiRateLimit');
  second.assertApiRequestAllowed();
  second.assertApiRequestAllowed();
  expect(first.assertApiRequestAllowed).toThrow('API_RATE_LIMITED');
  vi.setSystemTime(11000);
  for (let index = 0; index < 3; index += 1) first.assertApiRequestAllowed();
  expect(second.assertApiRequestAllowed).toThrow('API_RATE_LIMITED');
});

import { expect, it, beforeEach } from 'vitest';
import { useApiUsage } from '../../composables/useApiUsage';

beforeEach(() => {
  const usage = useApiUsage();
  usage.blocked.value = false;
  usage.dialogOpen.value = false;
});

it.each([
  { code: 'RESOURCE_EXHAUSTED' },
  { code: 'OVER_QUERY_LIMIT' },
  { code: 429 },
  new Error('Google Maps JavaScript API error: OverQuotaMapError'),
])('Google 配額錯誤開啟指定文案並阻擋後續呼叫：%s', async (error) => {
  const usage = useApiUsage();
  expect(usage.handleApiError(error)).toBe(true);
  expect(usage.dialogOpen.value).toBe(true);
  expect(usage.dialogMessage.value).toBe(
    '今日免費查詢額度已達上限，請明日再試！'
  );
  usage.dialogOpen.value = false;
  expect(usage.blocked.value).toBe(true);
  usage.handleApiError(new Error('Network failed'));
  expect(usage.dialogOpen.value).toBe(true);
  expect(usage.dialogMessage.value).toBe(
    '今日免費查詢額度已達上限，請明日再試！'
  );
});

it.each([
  new Error('Network failed'),
  { code: 'PERMISSION_DENIED' },
  { code: 403 },
])('網路或權限錯誤不當成配額不足：%s', (error) => {
  const usage = useApiUsage();
  expect(usage.handleApiError(error)).toBe(false);
  expect(usage.blocked.value).toBe(false);
  expect(usage.dialogOpen.value).toBe(true);
  expect(usage.dialogMessage.value).toBe(
    error instanceof Error
      ? '網路連線異常，請確認連線後再試。'
      : '目前無法查詢，請稍後再試。'
  );
});

it('停車 API 每分鐘上限只提示稍候，不封鎖後續查詢', () => {
  const usage = useApiUsage();
  expect(usage.handleApiError(new Error('HTTP 429'))).toBe(false);
  expect(usage.blocked.value).toBe(false);
  expect(usage.dialogOpen.value).toBe(true);
  expect(usage.dialogMessage.value).toBe(
    '停車資料查詢太頻繁，請稍候約一分鐘再試。'
  );
});

it.each([
  new TypeError('Failed to fetch'),
  new DOMException('Timed out', 'TimeoutError'),
  new Error('HTTP 504'),
])('網路與逾時錯誤顯示網路提示：%s', (error) => {
  const usage = useApiUsage();
  usage.handleApiError(error);
  expect(usage.dialogMessage.value).toBe('網路連線異常，請確認連線後再試。');
  expect(usage.blocked.value).toBe(false);
});

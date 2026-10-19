import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('第六次查詢在送出前攔下並顯示 dialog，時間窗過後可恢復', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          lots: [],
          source: '市府',
          queriedAt: '',
          notice: '',
        })
      )
  );
  vi.stubGlobal('fetch', fetchMock);
  const { getCityParking } = await import('../../apis/nationalParking');
  const { useApiUsage } = await import('../../composables/useApiUsage');
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => getCityParking('Taipei'))
  );
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1
  );
  const usage = useApiUsage();
  expect(usage.dialogOpen.value).toBe(true);
  expect(usage.dialogMessage.value).toBe('操作過於頻繁，請稍後再試');
  expect(usage.blocked.value).toBe(false);
  vi.setSystemTime(11000);
  await expect(getCityParking('Taipei')).resolves.toHaveProperty(
    'source',
    '市府'
  );
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

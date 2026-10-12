import { beforeEach, expect, it, vi } from 'vitest';
import { useDrivingTimes } from '../../../views/explore/composables/useDrivingTimes';

const mocks = vi.hoisted(() => ({
  minutes: vi.fn(),
  blocked: { value: false },
  error: vi.fn(),
}));
vi.mock('../../../apis/routes', () => ({ getDrivingMinutes: mocks.minutes }));
vi.mock('../../../composables/useApiUsage', () => ({
  useApiUsage: () => ({ blocked: mocks.blocked, handleApiError: mocks.error }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.blocked.value = false;
  mocks.minutes.mockImplementation(async (_origin, destinations) =>
    destinations.map(() => 5)
  );
});
const origin = { lat: 25, lng: 121 };

it('最多 50 個終點一批，重複地點只查一次；同起終點暫存且五分鐘後重查', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const times = useDrivingTimes();
    const destinations = Array.from(
      { length: 51 },
      (_, index) => `places/${index}`
    );
    expect(
      await times.getMinutes(
        origin,
        [...destinations, destinations[0]!],
        () => true
      )
    ).toHaveLength(52);
    expect(mocks.minutes.mock.calls.map((call) => call[1].length)).toEqual([
      50, 1,
    ]);
    await times.getMinutes(origin, destinations, () => true);
    expect(mocks.minutes).toHaveBeenCalledTimes(2);
    now.mockReturnValue(301001);
    await times.getMinutes(origin, [destinations[0]!], () => true);
    expect(mocks.minutes).toHaveBeenCalledTimes(3);
  } finally {
    now.mockRestore();
  }
});

it('無效或封鎖中的操作不查詢；配額失敗後不查下一批', async () => {
  const times = useDrivingTimes();
  await times.getMinutes(origin, ['places/store'], () => false);
  mocks.blocked.value = true;
  await times.getMinutes(origin, ['places/store'], () => true);
  expect(mocks.minutes).not.toHaveBeenCalled();
  mocks.blocked.value = false;
  const error = new Error('RESOURCE_EXHAUSTED');
  mocks.minutes.mockRejectedValueOnce(error);
  expect(
    await times.getMinutes(
      origin,
      Array.from({ length: 51 }, (_, index) => `places/${index}`),
      () => true
    )
  ).toEqual([]);
  expect(mocks.minutes).toHaveBeenCalledTimes(1);
  expect(mocks.error).toHaveBeenCalledWith(error);
});

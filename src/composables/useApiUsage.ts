import { shallowRef } from 'vue';

const blocked = shallowRef(false);
const dialogOpen = shallowRef(false);
const dialogMessage = shallowRef('目前無法查詢，請稍後再試。');
const stop = (message = '目前無法查詢，請稍後再試。') => {
  dialogMessage.value = message;
  blocked.value = true;
  dialogOpen.value = true;
};
const handleApiError = (error: unknown) => {
  if (blocked.value) {
    dialogOpen.value = true;
    return true;
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  const quota =
    [
      '429',
      'RESOURCE_EXHAUSTED',
      'OVER_QUERY_LIMIT',
      'OVER_DAILY_LIMIT',
    ].includes(code) ||
    /\b(OverQuotaMapError|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|OVER_DAILY_LIMIT)\b/.test(
      message
    ) ||
    message === 'HTTP 429';
  if (quota) {
    stop('今日免費查詢額度已達上限，請明日再試！');
    return true;
  }
  const network =
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    (error instanceof Error &&
      ['TimeoutError', 'NetworkError'].includes(error.name)) ||
    /network|Failed to fetch|fetch failed|ERR_(NETWORK|INTERNET|CONNECTION)|HTTP 504/i.test(
      message
    );
  dialogMessage.value = network
    ? '網路連線異常，請確認連線後再試。'
    : '目前無法查詢，請稍後再試。';
  dialogOpen.value = true;
  return false;
};
export const useApiUsage = () => ({
  blocked,
  dialogOpen,
  dialogMessage,
  handleApiError,
});

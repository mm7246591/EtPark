const requestTimes: number[] = [];

// 僅限制本分頁送出的應用層請求；正式停車 API 另由 Netlify 依 IP 限流。
const assertApiRequestAllowed = () => {
  const now = Date.now();
  while (requestTimes.length && now - requestTimes[0]! >= 1000)
    requestTimes.shift();
  if (requestTimes.length >= 5) throw new Error('API_RATE_LIMITED');
  requestTimes.push(now);
};

export { assertApiRequestAllowed };

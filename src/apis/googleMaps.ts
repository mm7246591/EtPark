import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const mapsConfigured = Boolean(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
);
if (mapsConfigured)
  setOptions({
    key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    v: 'weekly',
    language: 'zh-TW',
    region: 'TW',
  });
export const loadMapsLibrary = <T extends keyof google.maps.ImportLibraryMap>(
  library: T
) => {
  if (!mapsConfigured) throw new Error('尚未設定 Google Maps API key');
  return importLibrary(library);
};
export const listenMapsQuotaError = (onError: (error: unknown) => void) => {
  const previous = console.error;
  // ponytail: 地圖載入沒有公開配額事件，僅比對 Google 的明確錯誤碼；SDK 改變輸出時需更新。
  const report = (...args: unknown[]) => {
    previous.apply(console, args);
    if (args.some((value) => /\bOverQuotaMapError\b/.test(String(value))))
      onError(new Error('OverQuotaMapError'));
  };
  console.error = report;
  return () => {
    if (console.error === report) console.error = previous;
  };
};
export { mapsConfigured };

import { expect, it, vi } from 'vitest';
import { listenMapsQuotaError } from '../../apis/googleMaps';

vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(),
}));

it('只攔截地圖明確的配額錯誤，保留 Console 輸出並在清理後恢復', () => {
  const original = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = vi.fn();
  const cleanup = listenMapsQuotaError(onError);
  try {
    console.error('Google Maps JavaScript API error: InvalidKeyMapError');
    expect(onError).not.toHaveBeenCalled();
    console.error(
      'Google Maps JavaScript API error: OverQuotaMapError https://developers.google.com/maps/'
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'OverQuotaMapError' })
    );
    expect(original).toHaveBeenCalledTimes(2);
    cleanup();
    expect(console.error).toBe(original);
    console.error('OverQuotaMapError');
    expect(onError).toHaveBeenCalledTimes(1);
  } finally {
    cleanup();
    original.mockRestore();
  }
});

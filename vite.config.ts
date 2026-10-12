import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    vue(),
    {
      name: 'vue-spec-plugin',
      enforce: 'pre',
      transform: (_code, id) => {
        if (/\.vue\?vue&type=spec(?:&|$)/.test(id)) {
          return { code: 'export default {};', map: null };
        }
        return null;
      },
    },
  ],
  server: {
    proxy: {
      '/api/parking': {
        target: 'https://tcgbusfs.blob.core.windows.net',
        changeOrigin: true,
        rewrite: (path) =>
          path
            .replace(
              '/api/parking/description',
              '/blobtcmsv/TCMSV_alldesc.json'
            )
            .replace(
              '/api/parking/availability',
              '/blobtcmsv/TCMSV_allavailable.json'
            ),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));

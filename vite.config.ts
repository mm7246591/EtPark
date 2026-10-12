import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { handleNationalParking } from './server/national-parking.mjs';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    {
      name: 'national-parking-api',
      configureServer: (server) => {
        const env = loadEnv(mode, process.cwd(), '');
        server.middlewares.use((request, response, next) => {
          if (
            new URL(request.url ?? '/', 'http://localhost').pathname !==
            '/api/parking/city'
          ) {
            next();
            return;
          }
          handleNationalParking(request, response, env);
        });
      },
    },
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

import { defineConfig } from '@vben/vite-config';

import { TDesignResolver } from '@tdesign-vue-next/auto-import-resolver';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      plugins: [
        AutoImport({
          imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
          resolvers: [
            TDesignResolver({
              library: 'vue-next',
            }),
          ],
          dts: './src/types/auto-imports.d.ts',
        }),
        Components({
          dts: './src/types/components.d.ts',
          resolvers: [
            TDesignResolver({
              library: 'vue-next',
            }),
          ],
        }),
      ],
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://127.0.0.1:3000/api',
            ws: true,
          },
        },
      },
    },
  };
});

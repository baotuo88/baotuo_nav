import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { handleAdminApiRequest } from './server/adminApi.js'
import { createNodeRequest, sendNodeResponse } from './server/nodeAdapter.js'

function btnavAdminApi(runtimeEnv) {
  return {
    name: 'btnav-admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/admin')) {
          next()
          return
        }

        try {
          const request = await createNodeRequest(req)
          const response = await handleAdminApiRequest(request, runtimeEnv)
          await sendNodeResponse(res, response)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : '本地管理接口启动失败',
            code: 'DEV_SERVER_ERROR'
          }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const runtimeEnv = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), '')
  }

  return {
    plugins: [
      btnavAdminApi(runtimeEnv),
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      // 配置SPA fallback，所有路由都返回index.html
      historyApiFallback: true,
    },
    build: {
      // 构建时也需要考虑路由配置
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router'],
            'admin': ['./src/views/AdminView.vue']
          }
        }
      }
    }
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Production builds must point at an absolute API URL. This is deliberately
// strict: a relative '/api' works locally only because of the dev proxy below,
// so shipping one to production produces an app that loads and then fails every
// request. Override with VITE_ALLOW_RELATIVE_API=true when the host serves the
// API on the same origin behind its own proxy (nginx, Render, a reverse proxy).

// Vite only reads .env files from its own project root by default. This project's
// secrets file lives one level up (the repo root, next to backend/), so envDir is
// pointed there and VITE_-prefixed values are loaded from both the root and the
// frontend directory.
export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, '..', 'VITE_'),
    ...loadEnv(mode, '.', 'VITE_'),
  }
  const backendTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'
  const apiUrl = env.VITE_API_URL || '/api'

  if (
    mode === 'production' &&
    apiUrl.startsWith('/') &&
    env.VITE_ALLOW_RELATIVE_API !== 'true'
  ) {
    throw new Error(
      `VITE_API_URL is "${apiUrl}" but a production build needs the absolute ` +
        'URL of the deployed API, e.g. https://api.your-domain.com/api\n' +
        'A relative URL only resolves through the dev-server proxy, which does ' +
        'not exist in a built bundle.\n' +
        'Set VITE_API_URL, or VITE_ALLOW_RELATIVE_API=true if your host serves ' +
        'the API on the same origin.',
    )
  }

  return {
    plugins: [react()],
    envDir: '..',
    server: {
      port: 7500,
      // Dev-only convenience: forwards /api to the local backend so the app can
      // run with the relative '/api' base. This proxy is NOT included in a
      // production build - for that, build with VITE_API_URL set to the real API.
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
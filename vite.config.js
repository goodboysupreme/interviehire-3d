import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

function devDeepSeekProxy(apiKey) {
  return {
    name: 'dev-deepseek-proxy',
    configureServer(server) {
      server.middlewares.use('/api/deepseek', (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', async () => {
          try {
            const { messages, jsonMode } = JSON.parse(body);
            const payload = { model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 3000 };
            if (jsonMode) payload.response_format = { type: 'json_object' };
            const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify(payload),
            });
            const data = await upstream.json();
            res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: mode !== 'production' ? [devDeepSeekProxy(env.DEEPSEEK_API_KEY)] : [],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          dashboard: resolve(__dirname, 'dashboard.html'),
          'dashboard-glass': resolve(__dirname, 'dashboard-glass.html'),
          'dashboard-crystal': resolve(__dirname, 'dashboard-crystal.html'),
        },
      },
    },
  };
});

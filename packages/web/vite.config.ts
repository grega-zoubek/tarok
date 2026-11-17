import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @tarok/engine in @tarok/ai sta workspace paketa, ki se v dev načinu
    // bereta iz zgrajenega dist/ (paketna exports map kaže tja). Zato ju
    // izključimo iz Vite pre-bundlanja; pred `pnpm dev` ju zgradi korenski
    // `dev` skript, v CI pa `pnpm build`.
    exclude: ['@tarok/engine', '@tarok/ai'],
  },
});

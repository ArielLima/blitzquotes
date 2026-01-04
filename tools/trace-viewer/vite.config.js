import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: resolve(__dirname, '../..'), // Read .env.local from project root
  envPrefix: 'EXPO_PUBLIC_', // Match the existing env var prefix
});

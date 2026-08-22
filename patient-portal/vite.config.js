import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Different port from frontend/ (5173) — deliberately a separate app the patient can run
    // alongside the staff SPA during local development, not a replacement for it.
    port: 5174,
  },
});

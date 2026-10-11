import { defineConfig } from 'vitest/config';

// base './' keeps asset URLs relative so the build works when GitHub Pages
// serves the site from a project subpath like /Campus-Event-Resource-Booking-Platform/
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  test: { environment: 'node' },
});

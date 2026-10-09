import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // Cada proceso con jsdom ocupa varios cientos de MB; con un proceso por
      // núcleo el equipo de desarrollo se quedaba sin memoria.
      maxWorkers: 2,
    },
  }),
)

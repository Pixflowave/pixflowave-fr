import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const preview = process.env.PREVIEW === 'true';

export default defineConfig({
  site: preview ? 'https://pixflowave.github.io' : 'https://pixflowave.fr',
  base: preview ? '/pixflowave-fr' : '/',
  integrations: [sitemap()],
});
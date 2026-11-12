import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeImageGroups from './src/lib/rehype-image-groups.mjs';

const preview = process.env.PREVIEW === 'true';

export default defineConfig({
  site: preview ? 'https://pixflowave.github.io' : 'https://pixflowave.fr',
  base: preview ? '/pixflowave-fr' : '/',
  integrations: [sitemap()],
  markdown: {
    // Moteur unified : nécessaire pour le plugin qui regroupe les images
    processor: unified({ rehypePlugins: [rehypeImageGroups] }),
  },
});

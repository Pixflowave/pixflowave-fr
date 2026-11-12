import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

import type { SchemaContext } from 'astro:content';

// coverImage : chemin relatif au fichier .md (ex. "./images/couverture.png"),
// vérifié et optimisé au build par astro:assets
const schema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    heading: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    coverImage: image().optional(),
    draft: z.boolean().default(false),
  });

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema,
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema,
});

export const collections = { pages, articles };
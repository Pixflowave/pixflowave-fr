import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

/** Adresse d'une entrée : "mon-article/index" → "mon-article" */
export const slugOf = (entry: { id: string }) => entry.id.replace(/\/index$/, '');

/** Articles publiés, du plus récent au plus ancien */
export async function getArticles(): Promise<Article[]> {
  return (await getCollection('articles', ({ data }) => !data.draft)).sort(
    (a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0)
  );
}

/**
 * Résumé : le champ `description` s'il existe, sinon le début du texte
 * (sans images, vidéos, liens bruts ni balises), coupé proprement vers `max` caractères.
 */
export function excerpt(entry: Article, max = 160): string {
  if (entry.data.description) return entry.data.description;
  const text = (entry.body ?? '')
    .split('\n')
    .filter((line) => !/^\s*(!\[|<|https?:\/\/)/.test(line)) // images, iframes, vidéos seules
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [texte](lien) → texte
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_>`]+/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '') + '…';
}

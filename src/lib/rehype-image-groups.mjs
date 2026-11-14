/**
 * Regroupe les images qui se suivent dans le Markdown dans un cadre
 * <div class="images"> : côte à côte si la place le permet, sinon l'une sous l'autre.
 *
 * Un « paragraphe image » est un <p> qui ne contient que des images
 * (éventuellement dans un lien) et des espaces.
 *
 * Chaque image reçoit ses proportions (--r) et sa largeur réelle (--w),
 * lues dans le fichier : le CSS aligne ainsi les images d'une ligne
 * sur une même hauteur et n'agrandit jamais une petite image.
 * Les panoramas (classe « pano ») occupent chacun une ligne entière,
 * sauf s'ils sont seulement deux dans le groupe : ils sont alors côte à côte.
 * ![texte](image.png "petit") : classe « petit », image à la moitié de la largeur.
 * Cas « mosaïque » (voir mosaic()) : images carrées empilées à gauche, images larges empilées à droite.
 */
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
const isBlank = (n) => n.type === 'text' && !n.value.trim();
const isImage = (n) =>
  n.type === 'element' &&
  (n.tagName === 'img' ||
    (n.tagName === 'a' && n.children.some(isImage) && n.children.every((c) => isImage(c) || isBlank(c))));
const isImageParagraph = (n) =>
  n.type === 'element' &&
  n.tagName === 'p' &&
  n.children.some(isImage) &&
  n.children.every((c) => isImage(c) || isBlank(c));

function group(parent) {
  if (!parent.children) return;
  const out = [];
  let current = null;
  for (const node of parent.children) {
    if (isImageParagraph(node)) {
      if (!current) {
        current = { type: 'element', tagName: 'div', properties: { className: ['images'] }, children: [] };
        out.push(current);
      }
      current.children.push(...node.children.filter(isImage));
    } else if (current && isBlank(node)) {
      // espace entre deux paragraphes image : on garde le groupe ouvert
    } else {
      current = null;
      out.push(node);
      group(node);
    }
  }
  parent.children = out;
}

function imagesOf(node, out = []) {
  if (node.type === 'element' && node.tagName === 'img') out.push(node);
  for (const c of node.children ?? []) imagesOf(c, out);
  return out;
}

async function addSizes(tree, file) {
  const dir = file.path ? dirname(file.path) : null;
  const groups = [];
  (function find(n) {
    if (n.type === 'element' && n.properties?.className?.includes?.('images')) groups.push(n);
    else for (const c of n.children ?? []) find(c);
  })(tree);
  for (const g of groups) {
    const ratios = new Map();
    for (const item of g.children) {
      const img = imagesOf(item)[0];
      // ![texte](image.png "petit") : image affichée à la moitié de la largeur
      if (img?.properties?.title === 'petit') {
        delete img.properties.title;
        item.properties.className = [...[].concat(item.properties.className ?? []), 'petit'];
      }
      const src = img?.properties?.src;
      if (!dir || typeof src !== 'string' || /^(https?:)?\/\//.test(src)) continue;
      try {
        const { width, height } = await sharp(resolve(dir, decodeURI(src))).metadata();
        if (!width || !height) continue;
        const r = width / height;
        ratios.set(item, r);
        item.properties ??= {};
        const style = `--r:${r.toFixed(4)};--w:${width}px`;
        item.properties.style = item.properties.style ? `${item.properties.style};${style}` : style;
        // panorama (au moins 2 fois plus large que haut) : toujours seul sur sa ligne
        if (r >= 2) item.properties.className = [...[].concat(item.properties.className ?? []), 'pano'];
      } catch {
        /* image introuvable ou illisible : affichage par défaut */
      }
    }
    // Image seule : jamais rognée, on réduit plutôt sa largeur (classe « seule »)
    if (g.children.filter((c) => c.type === 'element').length === 1) {
      g.properties.className = [...[].concat(g.properties.className), 'seule'];
    }
    // Groupe de deux panoramas seulement : côte à côte plutôt que l'un sous l'autre
    const elements = g.children.filter((c) => c.type === 'element');
    if (elements.length === 2 && elements.every((c) => ratios.get(c) >= 2)) {
      for (const c of elements) c.properties.className = [].concat(c.properties.className ?? []).filter((x) => x !== 'pano');
      g.properties.className = [...[].concat(g.properties.className), 'cote-a-cote'];
    }
    mosaic(g, ratios);
  }
}

/**
 * Mosaïque en deux colonnes, quand un groupe mélange au moins une image
 * carrée/verticale (proportions < 1,6) et au moins une image large (>= 1,6),
 * avec au moins 3 images en tout :
 *   - à gauche, les images carrées ou verticales, empilées ;
 *   - à droite, les images larges, empilées ;
 *   chaque colonne garde l'ordre du Markdown.
 * Une colonne de largeur x et d'images ri a pour hauteur x × somme(1/ri).
 * --a : largeur gauche / largeur droite pour que les deux colonnes aient la même hauteur
 *       ( = somme droite / somme gauche ).
 * --k : largeur / hauteur de l'ensemble, pour limiter sa hauteur en CSS.
 */
function mosaic(g, ratios) {
  const items = g.children.filter((c) => c.type === 'element');
  if (items.length < 3 || items.some((c) => !ratios.has(c))) return;
  const gauche = items.filter((c) => ratios.get(c) < 1.6);
  const droite = items.filter((c) => ratios.get(c) >= 1.6);
  if (!gauche.length || !droite.length) return;
  const somme = (list) => list.reduce((s, c) => s + 1 / ratios.get(c), 0);
  const sg = somme(gauche);
  const sd = somme(droite);
  const a = sd / sg;
  const k = (a + 1) / sd;
  // part de hauteur de chaque image dans sa colonne, proportionnelle à 1/ri
  const rangees = (list) => list.map((c) => `${(100 / ratios.get(c)).toFixed(2)}fr`).join(' ');
  const colonne = (cls, list) => ({
    type: 'element',
    tagName: 'div',
    properties: { className: ['mosaic-col', cls], style: `grid-template-rows:${rangees(list)}` },
    children: list,
  });
  g.properties.className = [...[].concat(g.properties.className), 'mosaic'];
  g.properties.style = `--a:${a.toFixed(4)};--k:${k.toFixed(4)}`;
  g.children = [colonne('mosaic-gauche', gauche), colonne('mosaic-droite', droite)];
}

/**
 * En-tête : si le texte commence par un groupe d'images ou une vidéo intégrée
 * (<iframe>/<video>), ce premier bloc reçoit la classe « en-tete ».
 * Le CSS l'affiche au-dessus du titre et de la date de l'article.
 */
function markHeader(tree) {
  const first = tree.children.find((n) => !(n.type === 'text' && !n.value.trim()));
  if (!first) return;
  if (first.type === 'element' && first.properties?.className?.includes?.('images')) {
    first.properties.className = [...first.properties.className, 'en-tete'];
    return;
  }
  const isVideo = (n) =>
    (n.type === 'raw' && /^\s*<(iframe|video)\b/i.test(n.value)) ||
    (n.type === 'element' && ['iframe', 'video'].includes(n.tagName));
  if (isVideo(first)) {
    const i = tree.children.indexOf(first);
    tree.children[i] = { type: 'element', tagName: 'div', properties: { className: ['en-tete'] }, children: [first] };
  }
}

export default function rehypeImageGroups() {
  return async (tree, file) => {
    group(tree);
    await addSizes(tree, file);
    markHeader(tree);
  };
}

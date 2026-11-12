/**
 * Regroupe les images qui se suivent dans le Markdown dans un cadre
 * <div class="images"> : côte à côte si la place le permet, sinon l'une sous l'autre.
 *
 * Un « paragraphe image » est un <p> qui ne contient que des images
 * (éventuellement dans un lien) et des espaces.
 */
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

export default function rehypeImageGroups() {
  return (tree) => group(tree);
}

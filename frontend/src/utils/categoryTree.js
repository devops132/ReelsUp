export function normalizeCategoryTree(raw) {
  const tree = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.tree) ? raw.tree : []);
  const flat = [];
  const index = {};

  const walk = (nodes, pathNames = []) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!node || typeof node.id === 'undefined') return;
      const idValue = Number(node.id);
      const id = Number.isNaN(idValue) ? node.id : idValue;
      const name = typeof node.name === 'string' ? node.name : '';
      const nextPath = [...pathNames, name];
      const depth = nextPath.length;
      const parentRaw = Object.prototype.hasOwnProperty.call(node, 'parent_id') ? node.parent_id : null;
      const parentValue = parentRaw == null ? null : Number(parentRaw);
      const entry = {
        id,
        name,
        parent_id: Number.isNaN(parentValue) ? null : parentValue,
        depth,
        path: nextPath,
        fullName: nextPath.join(' / '),
      };
      flat.push(entry);
      index[String(entry.id)] = entry;
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, nextPath);
      }
    });
  };

  walk(tree, []);
  return { tree, flat, index };
}

export function formatCategoryOption(entry) {
  if (!entry) return '';
  const indent = entry.depth > 1 ? '\u00A0\u00A0'.repeat(entry.depth - 1) + '↳ ' : '';
  return `${indent}${entry.fullName}`;
}

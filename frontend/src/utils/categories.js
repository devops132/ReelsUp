export function prepareCategoryOptions(categories = []) {
  return (categories || []).map((cat) => {
    const depth = Math.max(0, (cat?.depth || 1) - 1);
    const indent = depth > 0 ? `${'\u00A0'.repeat(depth * 2)}↳ ` : '';
    const breadcrumb = (cat?.path && cat.path.trim()) ? cat.path : (cat?.name || '');
    return {
      ...cat,
      depth: (cat?.depth || 1),
      breadcrumb,
      treeLabel: `${indent}${cat?.name || ''}`,
      displayLabel: `${indent}${breadcrumb}`,
    };
  });
}

export function buildCategoryMap(categories = []) {
  const map = new Map();
  (categories || []).forEach((cat) => {
    map.set(String(cat.id), cat);
  });
  return map;
}

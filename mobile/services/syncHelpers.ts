import type { Category, Product, SyncEvent, SyncResponse, Tag } from '@/types';

export function maxEntityVersion(items: { version: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.version));
}

export function maxCategoryVersion(categories: Category[]): number {
  let max = 0;
  const walk = (cats: Category[]) => {
    for (const c of cats) {
      max = Math.max(max, c.version);
      if (c.children?.length) walk(c.children);
    }
  };
  walk(categories);
  return max;
}

/** Single `since` for GET /sync — min of per-type max versions avoids missing low-version entities. */
export function computeSyncSince(
  products: Product[],
  categories: Category[],
  tags: Tag[]
): number {
  const caps = [
    maxEntityVersion(products),
    maxCategoryVersion(categories),
    maxEntityVersion(tags),
  ].filter((v) => v > 0);
  return caps.length === 0 ? 0 : Math.min(...caps);
}

export function updateCategoryInTree(
  categories: Category[],
  id: number,
  version: number,
  updatedAt: string
): Category[] {
  return categories.map((c) => {
    if (c.id === id) return { ...c, version, updated_at: updatedAt };
    if (c.children?.length) {
      return { ...c, children: updateCategoryInTree(c.children, id, version, updatedAt) };
    }
    return c;
  });
}

export function applyEventsToState(
  products: Product[],
  categories: Category[],
  tags: Tag[],
  events: SyncEvent[]
): { products: Product[]; categories: Category[]; tags: Tag[] } {
  let nextProducts = products;
  let nextCategories = categories;
  let nextTags = tags;

  for (const event of events) {
    switch (event.type) {
      case 'product_bump':
        nextProducts = nextProducts.map((p) =>
          p.id === event.entity_id
            ? { ...p, version: event.version, updated_at: event.updated_at }
            : p
        );
        break;
      case 'category_bump':
        nextCategories = updateCategoryInTree(
          nextCategories,
          event.entity_id,
          event.version,
          event.updated_at
        );
        break;
      case 'tag_bump':
        nextTags = nextTags.map((t) =>
          t.id === event.entity_id
            ? { ...t, version: event.version, updated_at: event.updated_at }
            : t
        );
        nextProducts = nextProducts.map((p) => ({
          ...p,
          tags: p.tags?.map((t) =>
            t.id === event.entity_id
              ? { ...t, version: event.version, updated_at: event.updated_at }
              : t
          ),
        }));
        break;
    }
  }

  return { products: nextProducts, categories: nextCategories, tags: nextTags };
}

export function flattenSyncEvents(response: SyncResponse): SyncEvent[] {
  return [...response.products, ...response.categories, ...response.tags];
}

export interface PageInfo {
  page: number; // 1-indexed
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; info: PageInfo } {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    pageItems,
    info: { page: safePage, pageSize, totalItems, totalPages },
  };
}

/** Mongo skip/limit variant for queries done at the DB level. */
export function mongoSkipLimit(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  return { skip: (safePage - 1) * pageSize, limit: pageSize };
}

/**
 * Computes PageInfo directly from a known total count, without allocating
 * a dummy array (use this after a Mongo countDocuments() call).
 */
export function pageInfoFromTotal(total: number, page: number, pageSize: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { page: safePage, pageSize, totalItems: total, totalPages };
}

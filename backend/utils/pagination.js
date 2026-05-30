export function parsePagination(query, defaults = { page: 1, limit: 20, maxLimit: 50 }) {
  const page = Math.max(1, Number(query.page) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, Number(query.limit) || defaults.limit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function paginationMeta({ total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

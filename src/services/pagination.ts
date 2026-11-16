export const DEFAULT_PAGE_LIMIT = 50;

export interface PageOptions {
  limit?: number;
  cursor?: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageApiResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export function buildPageQuery(
  options: PageOptions,
  additional: Record<string, string | undefined> = {},
): string {
  const parameters = [
    `limit=${encodeURIComponent(String(options.limit ?? DEFAULT_PAGE_LIMIT))}`,
  ];

  if (options.cursor !== undefined && options.cursor !== null) {
    parameters.push(`cursor=${encodeURIComponent(options.cursor)}`);
  }

  for (const [key, value] of Object.entries(additional)) {
    if (value !== undefined) {
      parameters.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      );
    }
  }

  return parameters.join("&");
}

export function normalizePage<TResponse, TItem>(
  response: PageApiResponse<TResponse>,
  normalizeItem: (item: TResponse) => TItem,
): Page<TItem> {
  return {
    items: response.items.map(normalizeItem),
    nextCursor: response.next_cursor,
  };
}

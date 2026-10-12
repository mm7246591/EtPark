import * as z from 'zod/mini';

export const requestWithSchema = async <T extends z.ZodMiniType>(
  schema: T,
  config: { url: string; method?: 'GET' | 'POST' }
) => {
  const response = await fetch(config.url, {
    signal: AbortSignal.timeout(20000),
    method: config.method ?? 'GET',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: unknown = await response.json();
  const result = z.safeParse(schema, data);
  if (!result.success)
    console.warn(`[schema] ${config.url}`, result.error.issues);
  return data as z.infer<T>;
};

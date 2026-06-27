export type ListOptions = {
  limit: number;
  offset: number;
};

export function addCondition(parts: string[], params: unknown[], sql: string, value: unknown): void {
  params.push(value);
  parts.push(sql.replace("?", `$${params.length}`));
}

export function addUpdate(
  parts: string[],
  params: unknown[],
  column: string,
  value: unknown
): void {
  if (value === undefined) return;
  params.push(value);
  parts.push(`${column} = $${params.length}`);
}

export function requireUpdates(parts: string[]): void {
  if (parts.length === 0) {
    const error = new Error("At least one field is required.") as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
}

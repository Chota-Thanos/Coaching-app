function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function answersMatch(selected: unknown | null, correct: unknown): boolean {
  if (selected === null || selected === undefined || correct === null || correct === undefined) {
    return false;
  }
  return canonicalJson(selected) === canonicalJson(correct);
}

export function numeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}


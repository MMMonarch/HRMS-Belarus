/**
 * Resolve a dotted path (e.g. "employee.lastName") against a nested object.
 * If an intermediate value is an array, the first element is used so that paths
 * like "branches.created_at" or "orders.reg_number" work when variableData has
 * branches: [{ created_at, ... }], orders: [{ reg_number, ... }].
 */
export function getNestedValue(
  obj: Record<string, unknown> | null | undefined,
  path: string,
): unknown {
  if (!obj) return undefined;
  return path.split(".").reduce<unknown>((current, key) => {
    if (current == null) return undefined;
    const target =
      Array.isArray(current) && current.length > 0 ? current[0] : current;
    if (target == null || typeof target !== "object") return undefined;
    return (target as Record<string, unknown>)[key];
  }, obj as unknown);
}

/**
 * Format a value for display in document mode.
 * If format is provided and value is a date string, formats accordingly.
 * Otherwise returns the string representation.
 */
export function formatVariableValue(
  value: unknown,
  format?: string | null,
): string {
  if (value == null) return "";
  if (format && typeof value === "string" && !isNaN(Date.parse(value))) {
    try {
      const d = new Date(value);
      if (format === "dd.MM.yyyy") {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
      }
    } catch {
      // fall through
    }
  }
  return String(value);
}

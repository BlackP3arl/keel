type LinkItem = {
  id: string;
  predecessorId: string | null;
};

/** True when pointing `id` at `predecessorId` would loop, including a self-link. */
export function wouldCreateCycle(
  items: LinkItem[],
  id: string,
  predecessorId: string | null,
): boolean {
  if (!predecessorId) return false;
  if (predecessorId === id) return true;

  const previous = new Map(items.map((item) => [item.id, item.predecessorId]));
  const seen = new Set<string>();
  let current: string | null = predecessorId;

  while (current) {
    if (current === id || seen.has(current)) return true;
    seen.add(current);
    current = previous.get(current) ?? null;
  }

  return false;
}

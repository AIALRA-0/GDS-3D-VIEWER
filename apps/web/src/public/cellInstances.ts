import type { Layout } from "./types";

export interface CellFocus { cell: string; mode: "highlight" | "isolate" | "hide" }
// Parent indices come from traversal, so cell names never need to be parsed out
// of display paths. A parent's geometry and all of its descendants stay together.
export function cellMatches(layout: Layout | null, cell: string) {
  const owners = new Map<string, string>(), instances: string[] = [];
  const inherited: (string | undefined)[] = [];
  for (const [index, item] of (layout?.occurrences ?? []).entries()) {
    const owner = item.cell === cell ? item.path : item.parent >= 0 ? inherited[item.parent] : undefined;
    inherited[index] = owner;
    if (item.cell === cell) instances.push(item.path);
    if (owner !== undefined) owners.set(item.path, owner);
  }
  return { owners, instances };
}

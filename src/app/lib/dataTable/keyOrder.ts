/**
 * Generic ordered-key-list helpers used by `DataTableBulkReorder.tsx`.
 *
 * Extracted from Studio's `@core/domain/zoneOrder.ts`, which mixes these
 * generic helpers with codeplug Zone/BuildEntityOverride-specific logic
 * (`resolveZoneListOrder`, `sortZonesByExportOrder`, `applyDenseZoneOrders`,
 * `reorderZoneIds`) that has no analogue in this app. Only the two
 * functions `DataTableBulkReorder.tsx` actually calls are ported here,
 * verbatim in logic, so the kit component compiles without pulling in
 * Studio's codeplug domain model.
 */

/**
 * Move selected keys as a block within the ordered id list.
 */
export function reorderSelectedKeys(
  keys: string[],
  selected: ReadonlySet<string>,
  direction: 'up' | 'down',
): string[] {
  const next = [...keys];
  const indices = next
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => selected.has(key))
    .map(({ index }) => index);

  if (direction === 'up') {
    for (const index of indices.sort((a, b) => a - b)) {
      if (index === 0) continue;
      const above = index - 1;
      if (selected.has(next[above]!)) continue;
      [next[above], next[index]] = [next[index]!, next[above]!];
    }
  } else {
    for (const index of indices.sort((a, b) => b - a)) {
      if (index >= next.length - 1) continue;
      const below = index + 1;
      if (selected.has(next[below]!)) continue;
      [next[below], next[index]] = [next[index]!, next[below]!];
    }
  }
  return next;
}

/**
 * Reorder by drag-drop (dnd-kit): move `activeKey`, or the full `selectedKeys`
 * block when active is selected, to the position of `overKey`. Preserves relative
 * order within the moving block. Mirrors single-item `arrayMove` semantics.
 */
export function reorderKeysByDrag(
  keys: readonly string[],
  activeKey: string,
  overKey: string,
  selectedKeys?: ReadonlySet<string>,
): string[] {
  const list = [...keys];
  if (!list.includes(activeKey) || !list.includes(overKey) || activeKey === overKey) {
    return list;
  }

  const moving =
    selectedKeys?.has(activeKey) === true
      ? list.filter((key) => selectedKeys.has(key))
      : [activeKey];

  if (moving.length === 0) return list;

  const movingSet = new Set(moving);
  if (movingSet.has(overKey) && moving.length > 1) return list;

  const activeIndex = list.indexOf(activeKey);
  const overIndex = list.indexOf(overKey);
  const remaining = list.filter((key) => !movingSet.has(key));
  let insertAt = remaining.indexOf(overKey);
  if (insertAt < 0) return list;

  if (activeIndex < overIndex) {
    insertAt += 1;
  }

  remaining.splice(insertAt, 0, ...moving);
  return remaining;
}

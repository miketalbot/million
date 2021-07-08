import { VElement, VDeltas, VDiffEffect } from './structs';

/*
  Code adapted from https://github.com/ashaffer/dift
  Original Code License: Copyright © 2015, Weo.io <info@weo.io>
*/
export const diff = (
  oldVElementChildren: VElement[],
  newVElementChildren: VElement[],
  effect: VDiffEffect,
): void => {
  let oldStartIdx = 0;
  let newStartIdx = 0;
  let oldEndIdx = oldVElementChildren.length - 1;
  let newEndIdx = newVElementChildren.length - 1;
  let oldStartVElement = oldVElementChildren[oldStartIdx];
  let newStartVElement = newVElementChildren[newStartIdx];

  // List head is the same
  while (
    oldStartIdx <= oldEndIdx &&
    newStartIdx <= newEndIdx &&
    oldStartVElement.key === newStartVElement.key
  ) {
    effect(VDeltas.UPDATE, oldStartVElement, newStartVElement, newStartIdx);
    oldStartVElement = oldVElementChildren[++oldStartIdx];
    newStartVElement = newVElementChildren[++newStartIdx];
  }

  // The above case is orders of magnitude more common than the others, so fast-path it
  if (newStartIdx > newEndIdx && oldStartIdx > oldEndIdx) {
    return;
  }

  let oldEndVElement = oldVElementChildren[oldEndIdx];
  let newEndVElement = newVElementChildren[newEndIdx];
  let movedFromFront = 0;

  // Reversed
  while (
    oldStartIdx <= oldEndIdx &&
    newStartIdx <= newEndIdx &&
    oldStartVElement.key === newEndVElement.key
  ) {
    effect(VDeltas.MOVE, oldStartVElement, newEndVElement, oldEndIdx - movedFromFront + 1);
    oldStartVElement = oldVElementChildren[++oldStartIdx];
    newEndVElement = newVElementChildren[--newEndIdx];
    ++movedFromFront;
  }

  // Reversed the other way (in case of e.g. reverse and append)
  while (
    oldEndIdx >= oldStartIdx &&
    newStartIdx <= newEndIdx &&
    newStartVElement.key === oldEndVElement.key
  ) {
    effect(VDeltas.MOVE, oldEndVElement, newStartVElement, newStartIdx);
    oldEndVElement = oldVElementChildren[--oldEndIdx];
    newStartVElement = newVElementChildren[++newStartIdx];
    --movedFromFront;
  }

  // List tail is the same
  while (
    oldEndIdx >= oldStartIdx &&
    newEndIdx >= newStartIdx &&
    oldEndVElement.key &&
    newEndVElement.key
  ) {
    effect(VDeltas.UPDATE, oldEndVElement, newEndVElement, newEndIdx);
    oldEndVElement = oldVElementChildren[--oldEndIdx];
    newEndVElement = newVElementChildren[--newEndIdx];
  }

  if (oldStartIdx > oldEndIdx) {
    while (newStartIdx <= newEndIdx) {
      effect(VDeltas.CREATE, undefined, newStartVElement, newStartIdx);
      newStartVElement = newVElementChildren[++newStartIdx];
    }

    return;
  }

  if (newStartIdx > newEndIdx) {
    while (oldStartIdx <= oldEndIdx) {
      effect(VDeltas.REMOVE, oldStartVElement);
      oldStartVElement = oldVElementChildren[++oldStartIdx];
    }

    return;
  }

  let created = 0;
  let pivotDest = null;
  let pivotIdx = oldStartIdx - movedFromFront;
  const memoBase = oldStartIdx;
  const memo = new Uint32Array(Math.ceil(oldEndIdx - oldStartIdx / 32));

  const prevMap = keyMap(oldVElementChildren, oldStartIdx, oldEndIdx + 1);

  for (; newStartIdx <= newEndIdx; newStartVElement = newVElementChildren[++newStartIdx]) {
    const oldIdx = prevMap[newStartVElement.key!];

    if (oldIdx === undefined) {
      effect(VDeltas.CREATE, undefined, newStartVElement, pivotIdx++);
      ++created;
    } else if (oldStartIdx !== oldIdx) {
      effect(VDeltas.MOVE, oldVElementChildren[oldIdx], newStartVElement, pivotIdx++);
      setBit(memo, oldIdx - memoBase);
    } else {
      pivotDest = newStartIdx;
    }
  }

  if (pivotDest !== null) {
    setBit(memo, 0);
    effect(
      VDeltas.MOVE,
      oldVElementChildren[oldStartIdx],
      newVElementChildren[pivotDest],
      pivotDest,
    );
  }

  // If there are no creations, then you have to
  // remove exactly max(prevLen - nextLen, 0) elements in this
  // diff. You have to remove one more for each element
  // that was created. This means once we have
  // removed that many, we can stop.
  const necessaryRemovals = oldVElementChildren.length - newVElementChildren.length + created;
  for (
    let removals = 0;
    removals < necessaryRemovals;
    oldStartVElement = oldVElementChildren[++oldStartIdx]
  ) {
    if (!getBit(memo, oldStartIdx - memoBase)) {
      effect(VDeltas.REMOVE, oldStartVElement);
      ++removals;
    }
  }
};

const keyMap = (
  velements: VElement[],
  startIdx: number,
  endIdx: number,
): Record<string, number> => {
  const map = {};

  for (let i = startIdx; i < endIdx; ++i) {
    map[velements[i].key!] = i;
  }

  return map;
};

const setBit = (memo: Uint32Array, idx: number): void => {
  const result = idx % 32;
  const position = (idx - result) / 32;

  memo[position] |= 1 << result;
};

const getBit = (memo: Uint32Array, idx: number): boolean => {
  const result = idx % 32;
  const position = (idx - result) / 32;

  return !!(memo[position] & (1 << result));
};

// DFS based algorithm

import { OLD_VNODE_FIELD } from './constants';
import { createElement } from './createElement';
import { VDeltas, VElement, VFlags, VNode, VProps } from './structs';

/**
 * Diffs two VNode props and modifies the DOM node based on the necessary changes
 * @param {HTMLElement} el - Target element to be modified
 * @param {VProps} oldProps - Old VNode props
 * @param {VProps} newProps - New VNode props
 */
export const patchProps = (el: HTMLElement, oldProps: VProps, newProps: VProps): void => {
  const memo = new Set<string>();
  for (const oldPropName of Object.keys(oldProps)) {
    const newPropValue = newProps[oldPropName];
    if (newPropValue) {
      el[oldPropName] = newPropValue;
      memo.add(oldPropName);
    } else {
      el.removeAttribute(oldPropName);
      delete el[oldPropName];
    }
  }

  for (const newPropName of Object.keys(newProps)) {
    if (!memo.has(newPropName)) {
      el[newPropName] = newProps[newPropName];
    }
  }
};

/**
 * Diffs two VNode children and modifies the DOM node based on the necessary changes
 * @param {HTMLElement} el - Target element to be modified
 * @param {VNode[]} oldVNodeChildren - Old VNode children
 * @param {VNode[]} newVNodeChildren - New VNode children
 */
export const patchChildren = (
  el: HTMLElement,
  oldVNodeChildren: VNode[],
  newVNodeChildren: VNode[],
  keyed = false,
): void => {
  if (keyed) {
    diff(
      <VElement[]>oldVNodeChildren,
      <VElement[]>newVNodeChildren,
      (delta: VDeltas, oldVElement?: VElement, newVElement?: VElement, position?: number): void => {
        switch (delta) {
          case VDeltas.CREATE:
            el.insertBefore(createElement(newVElement!), el.childNodes[position!] || null);
            break;
          case VDeltas.UPDATE:
            patch(
              <HTMLElement>el.childNodes[oldVNodeChildren.indexOf(oldVElement!)],
              newVElement!,
              oldVElement,
            );
            break;
          case VDeltas.MOVE:
            console.log(position);
            // eslint-disable-next-line no-case-declarations
            const child = <HTMLElement>el.childNodes[oldVNodeChildren.indexOf(oldVElement!)];
            el.insertBefore(patch(child, newVElement!, oldVElement), child || null);
            break;
          case VDeltas.REMOVE:
            el.removeChild(<HTMLElement>el.childNodes[position!]);
            break;
        }
      },
    );
  } else {
    if (oldVNodeChildren) {
      for (let i = oldVNodeChildren.length - 1; i >= 0; --i) {
        patch(<HTMLElement | Text>el.childNodes[i], newVNodeChildren[i], oldVNodeChildren[i]);
      }
    }
    for (let i = oldVNodeChildren?.length ?? 0; i < newVNodeChildren.length; ++i) {
      el.appendChild(createElement(newVNodeChildren[i], false));
    }
  }
};

const replaceElementWithVNode = (el: HTMLElement | Text, newVNode: VNode): HTMLElement | Text => {
  if (typeof newVNode === 'string') {
    el.textContent = newVNode;
    return <Text>el.firstChild;
  } else {
    const newElement = createElement(newVNode);
    el.replaceWith(newElement);
    return newElement;
  }
};

/**
 * Diffs two VNodes and modifies the DOM node based on the necessary changes
 * @param {HTMLElement|Text} el - Target element to be modified
 * @param {VNode} newVNode - New VNode
 * @param {VNode=} prevVNode - Previous VNode
 * @returns {HTMLElement|Text}
 */
export const patch = (
  el: HTMLElement | Text,
  newVNode: VNode,
  prevVNode?: VNode,
): HTMLElement | Text => {
  if (!newVNode) {
    el.remove();
    return el;
  }

  const oldVNode: VNode | undefined = prevVNode ?? el[OLD_VNODE_FIELD];
  const hasString = typeof oldVNode === 'string' || typeof newVNode === 'string';

  if (hasString && oldVNode !== newVNode) return replaceElementWithVNode(el, newVNode);
  if (!hasString) {
    if (
      (!(<VElement>oldVNode)?.key && !(<VElement>newVNode)?.key) ||
      (<VElement>oldVNode)?.key !== (<VElement>newVNode)?.key
    ) {
      if (
        (<VElement>oldVNode)?.tag !== (<VElement>newVNode)?.tag &&
        !(<VElement>newVNode).children &&
        !(<VElement>newVNode).props
      ) {
        // newVNode has no props/children is replaced because it is generally
        // faster to create a empty HTMLElement rather than iteratively/recursively
        // remove props/children
        return replaceElementWithVNode(el, newVNode);
      }
      if (oldVNode && !(el instanceof Text)) {
        patchProps(el, (<VElement>oldVNode).props || {}, (<VElement>newVNode).props || {});

        switch (<VFlags>(<VElement>newVNode).flag) {
          case VFlags.NO_CHILDREN: {
            el.textContent = '';
            break;
          }
          case VFlags.ONLY_TEXT_CHILDREN: {
            el.textContent = <string>(<VElement>newVNode).children!.join('');
            break;
          }
          default: {
            patchChildren(
              el,
              (<VElement>oldVNode).children || [],
              (<VElement>newVNode).children!,
              <VFlags>(<VElement>newVNode).flag === VFlags.KEYED_CHILDREN,
            );
            break;
          }
        }
      }
    }
  }

  if (!prevVNode) el[OLD_VNODE_FIELD] = newVNode;

  return el;
};

// TODO: add attribution comment to JSDoc
export const diff = (
  oldVElementChildren: VElement[],
  newVElementChildren: VElement[],
  effect: (
    delta: VDeltas,
    oldVElement?: VElement,
    newVElement?: VElement,
    position?: number,
  ) => void,
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
  if (newStartIdx > newEndIdx && oldStartIdx > oldEndIdx) return;

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
  const oldMap = {};

  for (let i = oldStartIdx; i < oldEndIdx + 1; ++i) {
    oldMap[oldVElementChildren[i].key!] = i;
  }

  for (; newStartIdx <= newEndIdx; newStartVElement = newVElementChildren[++newStartIdx]) {
    const oldIdx = oldMap[newStartVElement.key!];

    if (oldIdx === undefined) {
      effect(VDeltas.CREATE, undefined, newStartVElement, pivotIdx++);
      ++created;
    } else if (oldStartIdx !== oldIdx) {
      effect(VDeltas.MOVE, oldVElementChildren[oldIdx], newStartVElement, pivotIdx++);
      const idx = oldIdx - memoBase;
      const result = idx % 32;
      const position = (idx - result) / 32;
      memo[position] |= 1 << result;
    } else {
      pivotDest = newStartIdx;
    }
  }

  if (pivotDest !== null) {
    memo[0] |= 1 << 0;
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
    const idx = oldStartIdx - memoBase;
    const result = idx % 32;
    const position = (idx - result) / 32;
    if (!(memo[position] & (1 << result))) {
      effect(VDeltas.REMOVE, oldStartVElement);
      ++removals;
    }
  }
};

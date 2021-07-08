export type VProps = Record<string, string | unknown | (() => void)>;
export type VNode = VElement | string;

export interface VElement {
  tag: string;
  props?: VProps;
  children?: VNode[];
  key?: string;
  flag?: VFlags;
}

export enum VFlags {
  NO_CHILDREN = 1 << 0,
  ONLY_TEXT_CHILDREN = 1 << 1,
  ANY_CHILDREN = 1 << 2,
  KEYED_CHILDREN = 1 << 3,
}

export enum VDeltas {
  CREATE = 1 << 0,
  UPDATE = 1 << 1,
  MOVE = 1 << 2,
  REMOVE = 1 << 3,
}

export type VDiffEffect = (
  delta: VDeltas,
  oldVElement?: VElement,
  newVElement?: VElement,
  position?: number,
) => void;

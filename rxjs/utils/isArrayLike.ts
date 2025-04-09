import { isFunction } from './isFunction';
export function isArrayLike(value: any): boolean {
  return value && !isFunction(value) && typeof value.length === 'number';
}
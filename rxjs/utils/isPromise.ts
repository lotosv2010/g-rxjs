import { isFunction } from "./isFunction";

export function isPromise(value: any): boolean {
  return value && isFunction(value.then);
}
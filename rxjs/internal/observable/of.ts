import { from } from './from';
export function of(...args: any[]) {
  return from(args);
}
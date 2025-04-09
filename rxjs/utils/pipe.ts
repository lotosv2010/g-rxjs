import { Observable } from "../internal/Observable";

export function pipeFromArray(fns: Array<(val: Observable) => Observable>) {
  if (!fns) {
    return (v: any) => v;
  }

  if (fns.length === 1) {
    return fns[0];
  }

  return function piped(input: Observable): Observable {
    return fns.reduce((prev, fn) => fn(prev), input);
  };
}
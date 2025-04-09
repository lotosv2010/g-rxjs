import { isFunction } from "../utils/isFunction";

export class Subscription {
  private _finalizers: Array<() => void> = [];
  add(teardown: () => void) {
    if (teardown && isFunction(teardown)) {
      this._finalizers.push(teardown);
    }
  }
  unsubscribe() {
    this._finalizers.forEach((teardown) => teardown());
  }
}
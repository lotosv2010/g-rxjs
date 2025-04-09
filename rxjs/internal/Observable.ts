import { Subscriber, ObserverType } from './Subscriber'

export class Observable {
  private _subscribe!: (subscriber: Subscriber) => any;

  constructor(subscribe: (subscriber: Subscriber) => void) {
    if (subscribe) {
      this._subscribe = subscribe;
    }
  }

  subscribe(observerOrNext: ObserverType): Subscriber {
    const subscriber = new Subscriber(observerOrNext);
    // 执行预先定义的订阅逻辑，将控制权交给观察者对象
    const teardown = this._subscribe(subscriber);
    // 添加取消订阅逻辑
    if (teardown) {
      subscriber.add(teardown);
    }
    return subscriber;
  }
  pipe(operation: (v: Observable) => Observable) {
    return operation(this);
  }
}
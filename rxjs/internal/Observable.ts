import { Subscriber, ObserverType } from './Subscriber'

export class Observable {
  private _subscribe!: (subscriber: Subscriber) => void;

  constructor(subscribe: (subscriber: Subscriber) => void) {
    if (subscribe) {
      this._subscribe = subscribe;
    }
  }

  subscribe(observerOrNext: ObserverType): Subscriber {
    const subscriber = new Subscriber(observerOrNext);
    // 执行预先定义的订阅逻辑，将控制权交给观察者对象
    this._subscribe(subscriber);
    return subscriber;
  }
}
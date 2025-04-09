import { Observable } from "./Observable";
import { Subscriber } from "./Subscriber";

export class Subject extends Observable {
  private subscribers: Subscriber[] = [];

  constructor() {
    super();
  }

  protected override _subscribe = (subscriber: Subscriber) => {
    this.subscribers.push(subscriber);
  } 

  next(value: any) {
    for (const subscriber of this.subscribers) {
      subscriber.next?.(value);
    }
  }

  complete(): void {
    for (const subscriber of this.subscribers) {
      subscriber.complete?.();
    }
  }
}
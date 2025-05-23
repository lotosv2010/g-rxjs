import { isFunction } from '../utils/isFunction'
import { Subscription } from './Subscription'

export type Next = (value: any) => void;
export interface ISubscriber {
  next?: Next;
  error?(err: any): void;
  complete?(): void;
}

export type ObserverType = ISubscriber | Next;

export class Subscriber extends Subscription {
  private destination: ISubscriber;
  private isStopped = false;
  constructor(observerOrNext: ObserverType) {
    super();
    const observer =
      isFunction(observerOrNext) ? { next: observerOrNext } : observerOrNext;
    this.destination = observer as ISubscriber;
  }
  next(value: any) {
    if (!this.isStopped) {
      this.destination.next?.(value);
    };
  }

  error(err: any) {
    this.destination.error?.(err);
  }
  complete() {
    if(!this.isStopped) {
      this.isStopped = true;
      this.destination.complete?.();
    }
  }
}

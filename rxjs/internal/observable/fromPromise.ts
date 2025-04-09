import { Observable } from '../Observable';

export function fromPromise(promise: Promise<any>) {
  return new Observable((subscriber) => {
    promise.then(
      (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      (err) => {
        subscriber.error(err);
      }
    );
  });
}
import { Observable } from "../Observable";

export function fromArrayLike(arrayLike: any) {
  return new Observable(subscriber => {
    for (let i = 0; i < arrayLike.length; i++) {
      subscriber.next(arrayLike[i]);
    }
    subscriber.complete();
  });
}
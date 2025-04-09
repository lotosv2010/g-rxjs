import { Observable } from "../Observable";

export function take(count: number) {
  return function(source: Observable): Observable {
    let seen: number = 0;
    return new Observable(function(subscriber) {
      source.subscribe({
        ...subscriber,
        next(value) {
          if (count > 0) {
            seen++;
            subscriber.next(value);
            if (seen >= count) {
              subscriber.complete();
            }
          }
        },
      })
    });
  }
}
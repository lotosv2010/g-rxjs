import { Observable } from "../Observable";

export function fromEvent(
  target: any,
  eventName: string,
  options?: EventListenerOptions | ((...args: any[]) => any),
  resultSelector?: (...args: any[]) => any
): Observable {
  return new Observable((subscriber) => {
    const handler = (...args: any[]) => {
      if (resultSelector) {
        subscriber.next(resultSelector(...args));
      } else {
        if (args.length === 1) {
          subscriber.next(args[0]);
        } else {
          subscriber.next(args);
        }
      }
    }
    target.addEventListener(
      eventName,
      handler,
      options
    );
    return () => {
      target.removeEventListener(
        eventName,
        handler,
        options
      );
    };
  });
}

import { Observable } from "../Observable";

export const EMPTY: Observable = new Observable(subscriber => {
  subscriber.complete();
});
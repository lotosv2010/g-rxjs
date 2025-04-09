import { Observable} from '../Observable'

// predicate 是过滤函数
export function filter(predicate: (value: any, index?: number) => boolean) {
  return (source: Observable): Observable => {
    return new Observable((subscriber) => {
      source.subscribe({
        ...subscriber,
        next(value) {
          if (predicate(value)) {
            subscriber.next(value);
          }
        },
      })
    })
  }
}
import { Observable } from '../Observable';

// project 是映射函数
export function map(project: (val: any) => any) {
  // source 是老的观察者
  return function (source: Observable): Observable {
    return new Observable(function (subscriber) {
      source.subscribe({
        ...subscriber,
        next(value) {
          subscriber.next(project(value));
        }
      });
    })
  }
}
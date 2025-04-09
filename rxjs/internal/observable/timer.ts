import { Scheduler } from "../Scheduler";
import { asyncScheduler } from "../scheduler/async";
import { Observable } from "../Observable";
import { AsyncAction } from "../AsyncAction";
export function timer(
  dueTime: number = 0,
  intervalOrScheduler?: number | Scheduler,
  scheduler: Scheduler = asyncScheduler
): Observable {
  let intervalDuration = -1;
  if (intervalOrScheduler) {
    if (typeof intervalOrScheduler === "number") {
      intervalDuration = intervalOrScheduler;
    } else if (intervalOrScheduler instanceof Scheduler) {
      scheduler = intervalOrScheduler;
    }
  }

  return new Observable((subscriber) => {
    let n = 0;
    return scheduler.schedule(function (this: AsyncAction) {
      subscriber.next(n++);
      if(intervalDuration > 0) {
        this.schedule(null, intervalDuration);
      } else {
        subscriber.complete();
      }
    }, dueTime);
  });
}

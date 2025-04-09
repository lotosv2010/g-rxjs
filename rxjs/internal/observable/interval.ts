import { timer } from "./timer";
import { Scheduler } from "../Scheduler";
import { asyncScheduler } from "../scheduler/async";

export function interval(period: number, scheduler: Scheduler = asyncScheduler) {
  return timer(period, period, scheduler)
}
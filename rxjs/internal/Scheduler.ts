import { AsyncAction } from './AsyncAction'

type AsyncActionType = typeof AsyncAction;

export class Scheduler {
  private _schedulerActionCtor: AsyncActionType;

  constructor(schedulerActionCtor: AsyncActionType) {
    this._schedulerActionCtor = schedulerActionCtor;
  }

  schedule(work: (time: number) => void, delay: number = 0, state?: any) {
    return new this._schedulerActionCtor(work).schedule(state, delay);
  }

}
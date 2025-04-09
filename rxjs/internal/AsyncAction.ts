export class AsyncAction {
  private _id: any = null;
  private _state: any;
  private _delay: number = 0;
  private _work: (time: number) => void;
  private _padding: boolean = false;
  constructor(work: (time: number) => void) {
    this._work = work;
  }

  schedule(state: any, delay: number = 0) {
    this._delay = delay;
    this._state = state;
    
    if (this._id) {
      this._id = this.recycledAsyncId();
    }
    this._padding = true;
    this._id = this.requestAsyncId();
  }
  requestAsyncId() {
    return setInterval(this.execute, this._delay)
  }
  recycledAsyncId() {
    clearInterval(this._id);
    return null;
  }
  execute = () => {
    this._padding = false;
    this._work.call(this, this._state);
    if (this._id && !this._padding) {
      this._id = this.recycledAsyncId();
    }
  }
}
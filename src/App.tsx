import "./App.css";
import { useEffect } from 'react'
import { asyncScheduler } from "../rxjs";
// import { asyncScheduler } from 'rxjs'

const start = () => {
  function task(this: any, state: any) {
    if (state < 5) {
      console.log('state', state);
      (this as any).schedule(state + 1, 500);
    }
  }

  asyncScheduler.schedule(task, 2000, 0);
}


function App() {
  useEffect(start, [])

  return (
    <>
      <div>hello RxJS</div>
    </>
  );
}

export default App;

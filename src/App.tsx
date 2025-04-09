import "./App.css";
import { useEffect } from 'react'
import { fromEvent } from "../rxjs";
// import { fromEvent } from 'rxjs'

const fromEventStart = () => {
  const clicks = fromEvent(document, 'click');
  const subscriber = clicks.subscribe(x => console.log(x, 'fromEvent'));
  setTimeout(() => {
    subscriber.unsubscribe();
  }, 3000)
}


function App() {
  useEffect(fromEventStart, [])

  return (
    <>
      <div>hello RxJS</div>
    </>
  );
}

export default App;

import "./App.css";
import { useEffect } from 'react'
import { take, interval } from "../rxjs";
// import { take, interval } from 'rxjs'

const start = () => {
  interval(1000).pipe(take(5)).subscribe(console.log)
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

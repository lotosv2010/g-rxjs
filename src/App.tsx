import "./App.css";
import { useEffect } from 'react'
import { timer, interval } from "../rxjs";
// import { timer, interval } from 'rxjs'

const start = () => {
  timer(1000).subscribe(console.log)
  interval(1000).subscribe(console.log)
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

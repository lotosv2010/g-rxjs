import "./App.css";
import { useEffect } from 'react'
import { of, map, filter } from "../rxjs";
// import { of, map, filter } from 'rxjs'

const start = () => {
  const observable = of(1, 2, 3, 4, 5)
  observable
    .pipe(map(x => x * 2)) // 2, 4, 6, 8, 10
    .pipe(filter(x => x > 4)) // 6, 8, 10
    .pipe(map(x => x + 1)) // 7, 9, 11
    .subscribe(x => console.log(x))
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

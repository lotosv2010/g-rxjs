import "./App.css";
import { useEffect } from 'react'
import { of , from} from "../rxjs";
// import { of, from } from 'rxjs'

const ofStart = () => {
  const observable = of(1, 2, 3);
  observable.subscribe({
    next: (value) => {
      console.log(value);
    },
    error: (err) => {
      console.log(err);
    },
    complete: () => {
      console.log('complete');
    }
  });
}

const fromStart = () => {
  const observable = from(Promise.resolve(1));
  observable.subscribe({
    next: (value) => {
      console.log(value);
    },
    error: (err) => {
      console.log(err);
    },
    complete: () => {
      console.log('complete');
    }
  });
}



function App() {
  useEffect(ofStart, [])
  useEffect(fromStart, [])

  return (
    <>
      <div>hello RxJS</div>
    </>
  );
}

export default App;

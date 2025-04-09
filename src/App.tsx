import "./App.css";
import { useEffect } from 'react'
import { Subject, Observable } from "../rxjs";
// import { Subject, Observable } from 'rxjs'

const coldStart = () => {
  const observer= new Observable((subscriber) => {
    subscriber.next(Math.random());
    subscriber.next(Math.random());
    subscriber.next(Math.random());
    subscriber.complete();
  });

  observer.subscribe({
    next: (v) => console.log(`observerA: ${v}`),
  });
  observer.subscribe({
    next: (v) => console.log(`observerB: ${v}`),
  });
}

const hotStart = () => {
  const subject = new Subject();
  subject.next(1);
  subject.subscribe({
    next: (v) => console.log(`observerA: ${v}`),
  });
  subject.next(2);
  subject.subscribe({
    next: (v) => console.log(`observerB: ${v}`),
  });
  subject.next(3);
}


function App() {
  useEffect(coldStart, [])
  useEffect(hotStart, [])


  return (
    <>
      <div>hello RxJS</div>
    </>
  );
}

export default App;

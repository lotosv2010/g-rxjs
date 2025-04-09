import { Observable } from '../Observable';
import { isPromise } from '../../utils/isPromise';
import { isArrayLike } from '../../utils/isArrayLike';
import { fromPromise } from './fromPromise';
import { fromArrayLike } from './fromArrayLike';
import { EMPTY } from './empty';

export function innerFrom(input: any): Observable {
  if (input instanceof Observable) {
    return input;
  } else if (isPromise(input)) {
    return fromPromise(input);
  } else if (isArrayLike(input)) {
    return fromArrayLike(input);
  } else {
    return EMPTY;
  }
}
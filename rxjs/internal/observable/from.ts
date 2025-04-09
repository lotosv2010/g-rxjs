import { innerFrom } from './innerFrom';
import { Observable } from '../Observable';
export function from(input: any[] | Promise<any>): Observable {
  return innerFrom(input);
}

import { FetcherType } from './Preloader';

export default function BufferSource(buffer: any[]) {
  let index=0
  const fetcher: FetcherType = async () => {
    console.log(`fetching ${index} of ${buffer.length}`);
    const annotation = buffer[index];
    index++;
    if (annotation) {
      return annotation;
    } else {
      //await forever
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return fetcher;
}

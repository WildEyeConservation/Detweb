import { FetcherType } from './Preloader';

export default class BufferSource {
  private index: number = 0;
  private buffer: any[];

  constructor(buffer: any[]) {
    this.buffer = buffer;
  }

  async fetch(): Promise<any> {
    console.log(`fetching ${this.index} of ${this.buffer.length}`);
    const annotation = this.buffer[this.index];
    this.index++;

    if (annotation) {
      return annotation;
    } else {
      //await forever
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

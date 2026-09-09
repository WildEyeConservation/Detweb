export default class BufferSource<T> {
  private index: number = 0;
  private buffer: T[];

  constructor(buffer: T[]) {
    this.buffer = buffer;
  }

  async fetch(): Promise<T> {
    console.log(`fetching ${this.index} of ${this.buffer.length}`);
    const annotation = this.buffer[this.index];
    this.index++;

    if (annotation) {
      return annotation;
    } else {
      //await forever
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

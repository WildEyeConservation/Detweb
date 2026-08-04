// jstat ships as CommonJS and attaches its distributions dynamically, so Node's
// ESM named-export detection does not see them. Only the default export is real
// at runtime — declaring named exports here compiles but throws in the container.
declare module 'jstat' {
  const jstat: {
    studentt: {
      inv(probability: number, degreesOfFreedom: number): number;
    };
  };
  export default jstat;
}

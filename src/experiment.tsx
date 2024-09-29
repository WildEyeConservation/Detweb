function firstElement<T>(arr: T[]) {
  return arr[0];
}

const x = [1, 2, 3];

export type ReturnTypeOfFirstElementWithX = typeof firstElement extends (arg: typeof x) => infer R ? R : never;

function inferReturnType(f: typeof firstElement, ) {
  if (crypto.randomUUID() < "A") {
    return f(x)
  }
  return "Hannes"
}

export const y = inferReturnType(firstElement, x)


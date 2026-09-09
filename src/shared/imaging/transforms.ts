import { type Matrix, multiply } from 'mathjs';

export const makeTransform =
  (H: Matrix | number[][]) =>
  (c1: [number, number]): [number, number] => {
    const result = multiply(H, [c1[0], c1[1], 1]).valueOf() as number[];
    return [result[0] / result[2], result[1] / result[2]];
  };

export const array2Matrix = (hc: number[] | null): number[][] | null => {
  if (hc && hc.length == 9) {
    const hcCopy = [...hc]; // Create a shallow copy of the input array
    const matrix = [];
    while (hcCopy.length) matrix.push(hcCopy.splice(0, 3));
    return matrix; // Removed unnecessary intermediate variable
  } else {
    return null;
  }
};

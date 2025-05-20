export class DefaultDict<T> {
  constructor(defaultInit: T | (() => T)) {
    return new Proxy<Record<string, T>>(
      {},
      {
        get: (target, name: string) =>
          name in target
            ? target[name]
            : (target[name] =
                typeof defaultInit === "function"
                  ? (defaultInit as () => T)()
                  : defaultInit),
      },
    );
  }
}

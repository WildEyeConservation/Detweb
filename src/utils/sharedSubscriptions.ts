type Subscription = { unsubscribe(): void };
type Entry = { count: number; subscriptions: Subscription[] };

// Cache updates belong to a particular QueryClient, even when filters match.
const registries = new WeakMap<object, Map<string, Entry>>();

export function acquireSubscriptions(
  owner: object,
  key: string,
  start: () => Subscription[]
) {
  let registry = registries.get(owner);
  if (!registry) {
    registry = new Map();
    registries.set(owner, registry);
  }
  let entry = registry.get(key);
  if (!entry) {
    entry = { count: 0, subscriptions: start() };
    registry.set(key, entry);
  }
  entry.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.count -= 1;
    if (entry.count === 0) {
      registry.delete(key);
      entry.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }
  };
}

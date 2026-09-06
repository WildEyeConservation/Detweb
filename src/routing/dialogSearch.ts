const DIALOG_PREFIX = 'dialog.';

export function dialogSearch(
  search: string | URLSearchParams,
  name: string | null,
  values: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams(search);
  for (const key of [...next.keys()]) {
    if (key === 'dialog' || key.startsWith(DIALOG_PREFIX)) next.delete(key);
  }
  if (name) {
    next.set('dialog', name);
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) next.set(`${DIALOG_PREFIX}${key}`, value);
    }
  }
  return next;
}

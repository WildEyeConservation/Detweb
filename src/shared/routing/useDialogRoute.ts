import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dialogSearch } from './dialogSearch';

// Query-addressed dialogs preserve the current report/map URL and its filters.
// Only identifiers and filter values belong here, never whole data objects.
export function useDialogRoute() {
  const [params, setParams] = useSearchParams();
  const open = useCallback(
    (name: string, values: Record<string, string | undefined> = {}) => {
      setParams((previous) => dialogSearch(previous, name, values));
    },
    [setParams]
  );
  const close = useCallback(() => {
    setParams((previous) => dialogSearch(previous, null));
  }, [setParams]);
  return {
    name: params.get('dialog'),
    get: (key: string) => params.get(`dialog.${key}`),
    open,
    close,
  };
}

import { lazy, type FC } from 'react';

const modules = import.meta.glob<{ DevActions: FC }>('./DevActions.tsx');
const load = modules['./DevActions.tsx'];
export const DevActions = load
  ? lazy(() => load().then(module => ({ default: module.DevActions })))
  : null;

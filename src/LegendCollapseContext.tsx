import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';

type LegendCollapseContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const LegendCollapseContext =
  createContext<LegendCollapseContextValue | null>(null);

/**
 * Provides shared legend-collapsed state for all AnnotationImage instances
 * in the preloader buffer. Without this, each buffered instance keeps its
 * own state initialized from localStorage at mount time, so already-loaded
 * siblings don't re-read when the visible image's toggle is clicked.
 *
 * Persisted per survey to localStorage as `legendCollapsed-${surveyId}`.
 */
export function LegendCollapseProvider({ children }: { children: ReactNode }) {
  const { surveyId } = useParams();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!surveyId) return false;
    return localStorage.getItem(`legendCollapsed-${surveyId}`) === 'true';
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (surveyId) {
        localStorage.setItem(`legendCollapsed-${surveyId}`, String(next));
      }
      return next;
    });
  }, [surveyId]);

  return (
    <LegendCollapseContext.Provider value={{ collapsed, toggle }}>
      {children}
    </LegendCollapseContext.Provider>
  );
}

/**
 * Returns the shared legend-collapsed state if a provider is mounted,
 * otherwise null. AnnotationImage falls back to local state when no
 * provider is present (e.g., when rendered standalone via LocationLoader).
 */
export function useLegendCollapse(): LegendCollapseContextValue | null {
  return useContext(LegendCollapseContext);
}

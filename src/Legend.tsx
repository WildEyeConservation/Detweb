import { useState, useEffect, useRef, useContext } from 'react';
import L from 'leaflet';
import { ProjectContext } from './Context';
import { Card, Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 *
 * Legend is a custom child component for react-leaflet. Like all child components it must be a descendant of a
 * MapContainer. It will add legend to the map. The legend will be minified by default will expand when one hovers over
 * it. It then shows which classes correspond to which colour markers in the Detweb GUI. One can also click on a legend
 * entry to select that class as the currently active class. Then the next click on the image itself will result in a
 * marker of the selected class being placed.
 * @component
 * @property {string} position The position of the control (one of the map corners). Possible values are 'topleft',
 * 'topright', 'bottomleft' or 'bottomright'
 * @property {function} onUpdateCategory A callback that is called when one of the legend entries is clicked. The index
 * of the category is supplied as a parameter to the function call. Typically used to select the clicked category.
 */

const POSITION_CLASSES = {
  bottomleft: 'leaflet-bottom leaflet-left',
  bottomright: 'leaflet-bottom leaflet-right',
  topleft: 'leaflet-top leaflet-left',
  topright: 'leaflet-top leaflet-right',
};

interface LegendProps {
  position?: keyof typeof POSITION_CLASSES;
  hideLegend?: boolean;
  setHideLegend?: VoidFunction;
  annotationSetId?: string;
  alwaysVisible?: boolean;
  // Optional: provide categories explicitly (e.g., when the annotation set is from another project)
  categoriesOverride?: any[];
}

interface SideLegendProps extends LegendProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SideLegend({
  annotationSetId,
  categoriesOverride,
  collapsed = false,
  onToggleCollapse,
}: SideLegendProps) {
  const {
    categoriesHook: { data: categories },
    setCurrentCategory,
  } = useContext(ProjectContext)!;
  const cats = categoriesOverride ?? categories;

  return (
    <div
      className='d-none d-md-flex flex-column ms-2'
      style={{
        position: 'relative',
        height: '100%',
        // Reserve space for the chevron toggle (which sits at left:-16, width:32)
        // so it doesn't overflow the parent flex row when the legend is collapsed.
        width: collapsed ? 32 : undefined,
        flexShrink: 0,
      }}
    >
      {/* Toggle button — small dark circle at the image/legend boundary when
          expanded, full-height rounded rectangle filling the column when
          collapsed (so the click target matches the legend's height). */}
      <button
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand legend' : 'Collapse legend'}
        className='d-flex align-items-center justify-content-center'
        style={{
          position: 'absolute',
          left: collapsed ? 0 : '-16px',
          top: collapsed ? 0 : '50%',
          transform: collapsed ? undefined : 'translateY(-50%)',
          zIndex: 10,
          width: 32,
          height: collapsed ? '100%' : 32,
          borderRadius: collapsed ? 10 : '50%',
          padding: 0,
          background: 'var(--ss-accent)',
          border: '1.5px solid var(--ss-accent)',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: collapsed
            ? '0 1px 3px rgba(28, 28, 26, 0.12)'
            : '0 2px 6px rgba(28, 28, 26, 0.18)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--ss-accent-hover)';
          e.currentTarget.style.borderColor = 'var(--ss-accent-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--ss-accent)';
          e.currentTarget.style.borderColor = 'var(--ss-accent)';
        }}
      >
        {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {!collapsed && (
        <Card
          className='d-flex flex-column h-100 overflow-hidden'
          style={{ width: 280 }}
        >
          <Card.Header>
            <Card.Title className='d-flex flex-row align-items-center gap-2 mb-2'>
              <span>Legend</span>
            </Card.Title>
            <span className='text-muted' style={{ fontSize: '14px' }}>
              Click on a label to annotate with or use the shortcut key
            </span>
          </Card.Header>
          <Card.Body className='d-flex flex-column gap-2 overflow-auto'>
            {cats
              ?.filter((c) => c.annotationSetId === annotationSetId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((category) => (
                <Button
                  variant={'primary'}
                  key={category.id}
                  className='d-flex flex-row align-items-center justify-content-between gap-2'
                  onClick={() => setCurrentCategory(category)}
                >
                  <div className='d-flex flex-row align-items-center gap-2'>
                    <div
                      style={{ backgroundColor: category.color || '#000' }}
                      className='rounded-circle p-2'
                    ></div>
                    <div>{category.name}</div>
                  </div>
                  <div>({category.shortcutKey})</div>
                </Button>
              ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

interface MapLegendProps extends LegendProps {
  forceVisible?: boolean;
}

export function MapLegend({
  position,
  annotationSetId,
  alwaysVisible = false,
  categoriesOverride,
  forceVisible = false,
}: MapLegendProps) {
  const {
    categoriesHook: { data: categories },
    setCurrentCategory,
    currentCategory,
  } = useContext(ProjectContext)!;
  const cats = categoriesOverride ?? categories;
  const divRef = useRef<HTMLDivElement | null>(null);
  const positionClass =
    (position && POSITION_CLASSES[position]) || POSITION_CLASSES.bottomright;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
    }
  });

  // Determine visibility class
  const visibilityClass = alwaysVisible || forceVisible
    ? ' d-block'
    : ' d-block d-md-none';

  return (
    <div
      ref={divRef}
      className={positionClass + visibilityClass}
    >
      <div
        className='leaflet-control'
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          background: 'var(--ss-surface)',
          border: '1.5px solid var(--ss-border)',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(28, 28, 26, 0.12)',
          color: 'var(--ss-text)',
          minWidth: expanded ? 180 : 'auto',
          overflow: 'hidden',
          transition: 'min-width 0.15s',
        }}
      >
        <div className='d-flex flex-column'>
          {expanded ? (
            cats
              ?.filter((c) => c.annotationSetId === annotationSetId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item, index) => {
                const isActive = currentCategory?.id === item.id;
                return (
                  <div
                    key={index}
                    onClick={() => setCurrentCategory(item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isActive
                        ? 'var(--ss-accent-soft)'
                        : 'transparent',
                      color: isActive ? 'var(--ss-green)' : 'var(--ss-text)',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      transition: 'background 0.1s',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: item.color || '#000',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>{item.name}</div>
                      <div style={{ color: 'var(--ss-text-muted)', fontSize: 12 }}>
                        ({item.shortcutKey})
                      </div>
                    </div>
                  </div>
                );
              })
          ) : (
            <div
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ss-text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Legend
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

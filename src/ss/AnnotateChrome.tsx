import { createContext, useState } from 'react';
import { Outlet } from 'react-router-dom';

type ChromeSlots = {
  centerEl: HTMLDivElement | null;
  rightEl: HTMLDivElement | null;
};

export const AnnotateChromeContext = createContext<ChromeSlots>({
  centerEl: null,
  rightEl: null,
});

export function AnnotateShell() {
  const [centerEl, setCenterEl] = useState<HTMLDivElement | null>(null);
  const [rightEl, setRightEl] = useState<HTMLDivElement | null>(null);

  return (
    <AnnotateChromeContext.Provider value={{ centerEl, rightEl }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          overflow: 'hidden',
          background: 'var(--ss-content-bg)',
        }}
      >
        <header
          style={{
            background: 'var(--ss-sidebar-bg)',
            color: '#fff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
            borderBottom: '1px solid rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img
              src='/Logo.png'
              alt='Logo'
              style={{ height: 32, marginRight: 4 }}
            />
            <div>
              <div
                style={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}
              >
                SurveyScope
              </div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                AI Aerial-Census Software
              </div>
            </div>
          </div>
          <div
            ref={setCenterEl}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              minWidth: 0,
            }}
          />
          <div
            ref={setRightEl}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          />
        </header>
        <main
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            overflow: 'hidden',
          }}
        >
          <Outlet />
        </main>
      </div>
    </AnnotateChromeContext.Provider>
  );
}

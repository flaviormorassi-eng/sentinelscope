import React from 'react';

function isLegacyAuthEnabled() {
  const dev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
  const flag = typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_DISABLE_FIREBASE_AUTH === 'true' || (import.meta as any).env?.VITE_DISABLE_FIREBASE_AUTH === '1');
  return Boolean(dev || flag);
}

export function DevAuthNotice() {
  const [hidden, setHidden] = React.useState<boolean>(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem('hideDevAuthNotice') === '1';
  });
  const [userId, setUserId] = React.useState<string>(() => {
    if (typeof localStorage === 'undefined') return 'demo';
    return localStorage.getItem('devUserId') || 'demo';
  });

  if (!isLegacyAuthEnabled() || hidden) return null;

  function applyUserId(next: string) {
    try {
      localStorage.setItem('devUserId', next || 'demo');
    } catch {}
  }

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-amber-50 text-amber-900">
      <div className="mx-auto flex items-center gap-3 px-4 py-1 text-sm">
        <span className="font-medium">Legacy auth mode</span>
        <span className="opacity-80">using <code className="px-1">x-user-id</code></span>
        <label className="ml-2 flex items-center gap-2">
          <span className="opacity-70">user:</span>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onBlur={() => applyUserId(userId)}
            placeholder="demo or UID"
            className="h-7 rounded border border-amber-300 bg-white px-2 text-amber-900 focus:outline-none"
          />
        </label>
        <button
          onClick={() => applyUserId(userId)}
          className="h-7 rounded bg-amber-600 px-2 text-white hover:bg-amber-700"
        >Apply</button>
        <button
          onClick={() => { try { sessionStorage.setItem('hideDevAuthNotice','1'); } catch {}; setHidden(true); }}
          className="ml-auto h-7 rounded px-2 text-amber-900 hover:bg-amber-100"
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  );
}

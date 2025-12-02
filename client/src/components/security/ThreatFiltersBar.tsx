import React from 'react';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Props {
  className?: string;
  typeOptions: string[];
  selectedType?: string;
  onSelectType: (t?: string) => void;
  sourceQuery: string;
  onSourceQueryChange: (q: string) => void;
  selectedSeverity?: Severity;
  onSelectSeverity?: (s?: Severity) => void;
  onClearAll?: () => void;
  onCopyLink?: () => void;
  onResetDefaults?: () => void;
  perTabScope?: boolean;
  onToggleScope?: () => void;
}

const ThreatFiltersBar: React.FC<Props> = ({
  className,
  typeOptions,
  selectedType,
  onSelectType,
  sourceQuery,
  onSourceQueryChange,
  selectedSeverity,
  onSelectSeverity,
  onClearAll,
  onCopyLink,
  onResetDefaults,
  perTabScope,
  onToggleScope,
}) => {
  const types = Array.from(new Set(typeOptions)).filter(Boolean).sort();
  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Grid layout: Source full-width, second row with Type & Severity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Source Row spans both on md */}
        <div className="md:col-span-2 flex flex-col">
          <label className="text-xs text-muted-foreground mb-1" htmlFor="threat-source-input">Source (IP / URL / Device)</label>
          <input
            id="threat-source-input"
            className="h-11 rounded-md border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring w-full"
            placeholder="e.g., 203.0.113.42 or example.com"
            value={sourceQuery}
            onChange={(e) => onSourceQueryChange(e.target.value)}
          />
          <span className="mt-1 text-[11px] text-muted-foreground">Partial match: IP, domain, or device name</span>
        </div>
        {/* Threat Type */}
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1" htmlFor="threat-type-select">Threat Type</label>
          <select
            id="threat-type-select"
            className="h-11 rounded-md border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedType || ''}
            onChange={(e) => onSelectType(e.target.value || undefined)}
          >
            <option value="">All</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Severity */}
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">Severity</label>
          <div className="flex flex-wrap gap-2">
            {(['critical','high','medium','low'] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === s ? undefined : s)}
                className={`text-xs px-3 py-2 rounded-md border capitalize ${selectedSeverity === s ? 'bg-foreground text-background' : 'bg-muted text-foreground'}`}
                title={s}
              >
                {s}
              </button>
            ))}
            {selectedSeverity && (
              <button
                type="button"
                onClick={() => onSelectSeverity && onSelectSeverity(undefined)}
                className="text-[11px] px-2 py-2 rounded-md border bg-background hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Actions row */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button
          type="button"
          className="h-9 px-3 rounded-md border bg-background text-sm"
          onClick={onClearAll}
          title="Clear all filter values (severity, type, source)"
        >
          Clear Filters
        </button>
        {onToggleScope && (
          <button
            type="button"
            className="h-9 px-3 rounded-md border bg-background text-sm"
            onClick={onToggleScope}
            title="Toggle between per-tab and global user scope"
          >
            Scope: {perTabScope ? 'Tab' : 'Global'}
          </button>
        )}
        {onResetDefaults && (
          <button
            type="button"
            className="h-9 px-3 rounded-md border bg-background text-sm"
            onClick={onResetDefaults}
            title="Remove query parameters from URL (does not clear filters)"
          >
            Reset URL Params
          </button>
        )}
        {onCopyLink && (
          <button
            type="button"
            className="h-9 px-3 rounded-md border bg-background text-sm"
            onClick={onCopyLink}
          >
            Copy link
          </button>
        )}
      </div>
    </div>
  );
};

export default ThreatFiltersBar;

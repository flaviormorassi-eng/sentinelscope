import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Severity } from '@/components/security/ThreatFiltersBar';

interface UseThreatFiltersResult {
  severityFilter?: Severity;
  setSeverityFilter: (s?: Severity) => void;
  typeFilter?: string;
  setTypeFilter: (t?: string) => void;
  typeFilterEffective?: string; // debounced
  sourceInput: string; // immediate value
  setSourceInput: (v: string) => void;
  sourceQuery: string; // debounced value used for filtering/persistence
  statusFilter?: string;
  setStatusFilter: (s?: string) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  searchQuery: string;
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  clearFilters: () => void;
  resetUrl: () => void;
  perTabScope: boolean;
  toggleScope: () => void;
  storagePrefix: string;
}

// Centralizes filter state + persistence (URL & localStorage) with per-tab scope toggle
export function useThreatFilters(userUid?: string): UseThreatFiltersResult {
  const [severityFilter, setSeverityFilter] = useState<Severity | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [typeFilterEffective, setTypeFilterEffective] = useState<string | undefined>(undefined);
  const [sourceInput, setSourceInput] = useState<string>('');
  const [sourceQuery, setSourceQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [perTabScope, setPerTabScope] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const raw = localStorage.getItem(`dash.${userUid || 'anon'}.scope`);
    return raw === 'global' ? false : true; // default to tab scope
  });

  // session tab id
  const tabId = useMemo(() => {
    if (typeof window === 'undefined') return 'tab';
    let id = sessionStorage.getItem('tabId');
    if (!id) { id = Math.random().toString(36).slice(2, 8); sessionStorage.setItem('tabId', id); }
    return id;
  }, []);

  const storagePrefix = useMemo(() => {
    return `dash.${userUid || 'anon'}${perTabScope ? '.' + tabId : ''}`;
  }, [userUid, perTabScope, tabId]);

  // Debounce type filter
  useEffect(() => {
    const h = window.setTimeout(() => setTypeFilterEffective(typeFilter), 200);
    return () => window.clearTimeout(h);
  }, [typeFilter]);

  // Debounce source input into sourceQuery
  useEffect(() => {
    const h = window.setTimeout(() => setSourceQuery(sourceInput), 300);
    return () => window.clearTimeout(h);
  }, [sourceInput]);

  // Debounce search input into searchQuery
  useEffect(() => {
    const h = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(h);
  }, [searchInput]);

  // Initialize from URL or localStorage
  useEffect(() => {
    try {
      const allowedSev: Severity[] = ['critical','high','medium','low'];
      const allowedStatus = ['detected','pending_review','blocked','allowed','unblocked'];
      const sp = new URLSearchParams(window.location.search);
      const sev = sp.get('sev') as Severity | null;
      const type = sp.get('type');
      const src = sp.get('src');
      const status = sp.get('status');
      const q = sp.get('q');
      const p = sp.get('page');
      const ps = sp.get('pageSize');
      let hasUrl = false;
      if (sev && allowedSev.includes(sev)) { setSeverityFilter(sev); hasUrl = true; }
      if (type) { setTypeFilter(type); hasUrl = true; }
      if (src) { setSourceInput(src); setSourceQuery(src); hasUrl = true; }
      if (status && allowedStatus.includes(status)) { setStatusFilter(status); hasUrl = true; }
      if (q) { setSearchInput(q); setSearchQuery(q); hasUrl = true; }
      if (p && !Number.isNaN(Number(p))) { setPage(Math.max(1, parseInt(p,10))); hasUrl = true; }
      if (ps && !Number.isNaN(Number(ps))) { setPageSize(Math.max(1, parseInt(ps,10))); hasUrl = true; }
      if (!hasUrl) {
        const lsSev = localStorage.getItem(`${storagePrefix}.sev`) as Severity | null;
        const lsType = localStorage.getItem(`${storagePrefix}.type`);
        const lsSrc = localStorage.getItem(`${storagePrefix}.src`);
        const lsStatus = localStorage.getItem(`${storagePrefix}.status`);
        const lsQ = localStorage.getItem(`${storagePrefix}.q`);
        const lsPage = localStorage.getItem(`${storagePrefix}.page`);
        const lsPageSize = localStorage.getItem(`${storagePrefix}.pageSize`);
        if (lsSev && allowedSev.includes(lsSev)) setSeverityFilter(lsSev);
        if (lsType) setTypeFilter(lsType);
        if (lsSrc) { setSourceInput(lsSrc); setSourceQuery(lsSrc); }
        if (lsStatus && allowedStatus.includes(lsStatus)) setStatusFilter(lsStatus);
        if (lsQ) { setSearchInput(lsQ); setSearchQuery(lsQ); }
        if (lsPage && !Number.isNaN(Number(lsPage))) setPage(Math.max(1, parseInt(lsPage,10)));
        if (lsPageSize && !Number.isNaN(Number(lsPageSize))) setPageSize(Math.max(1, parseInt(lsPageSize,10)));
      }
    } catch {}
  }, [storagePrefix]);

  // Persist to URL (sev,type,src)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const setOrDel = (k: string, v?: string) => {
        if (v && v.length > 0) sp.set(k, v); else sp.delete(k);
      };
      setOrDel('sev', severityFilter);
      setOrDel('type', typeFilterEffective);
      setOrDel('src', sourceQuery);
      setOrDel('status', statusFilter);
      setOrDel('q', searchQuery);
      // Persist numeric params as well
      if (page) sp.set('page', String(page)); else sp.delete('page');
      if (pageSize) sp.set('pageSize', String(pageSize)); else sp.delete('pageSize');
      const qs = sp.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      const current = window.location.pathname + (window.location.search ? window.location.search : '');
      if (newUrl !== current) window.history.replaceState(null, '', newUrl);
    } catch {}
  }, [severityFilter, typeFilterEffective, sourceQuery, statusFilter, searchQuery, page, pageSize]);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setOrRemove = (k: string, v?: string) => {
      if (v && v.length > 0) localStorage.setItem(k, v); else localStorage.removeItem(k);
    };
    setOrRemove(`${storagePrefix}.sev`, severityFilter);
    setOrRemove(`${storagePrefix}.type`, typeFilterEffective);
    setOrRemove(`${storagePrefix}.src`, sourceQuery);
    setOrRemove(`${storagePrefix}.status`, statusFilter);
    setOrRemove(`${storagePrefix}.q`, searchQuery);
    localStorage.setItem(`${storagePrefix}.page`, String(page));
    localStorage.setItem(`${storagePrefix}.pageSize`, String(pageSize));
  }, [severityFilter, typeFilterEffective, sourceQuery, statusFilter, searchQuery, page, pageSize, storagePrefix]);

  // Persist scope selection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`dash.${userUid || 'anon'}.scope`, perTabScope ? 'tab' : 'global');
  }, [perTabScope, userUid]);

  const clearFilters = useCallback(() => {
    setSeverityFilter(undefined);
    setTypeFilter(undefined);
    setSourceInput('');
    setSourceQuery('');
    setStatusFilter(undefined);
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  }, []);

  const resetUrl = useCallback(() => {
    try {
      const path = window.location.pathname;
      window.history.replaceState(null, '', path);
    } catch {}
  }, []);

  const toggleScope = useCallback(() => {
    setPerTabScope(s => !s);
  }, []);

  return {
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    typeFilterEffective,
    sourceInput,
    setSourceInput,
    sourceQuery,
    statusFilter,
    setStatusFilter,
    searchInput,
    setSearchInput,
    searchQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
    resetUrl,
    perTabScope,
    toggleScope,
    storagePrefix,
  };
}

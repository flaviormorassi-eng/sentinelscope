import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { apiRequest } from '@/lib/queryClient';
import { AlertTriangle, Bell, User as UserIcon, FileText, Settings, Map, Shield } from 'lucide-react';

interface SearchResult {
  type: 'threat' | 'threat_event' | 'alert' | 'user' | 'page';
  id: string;
  title: string;
  description?: string;
  url: string;
}

const staticPages: SearchResult[] = [
  { type: 'page', id: 'dashboard', title: 'Dashboard', url: '/dashboard' },
  { type: 'page', id: 'threats', title: 'Threat Log', url: '/threats' },
  { type: 'page', id: 'alerts', title: 'Alerts', url: '/alerts' },
  { type: 'page', id: 'map', title: 'Threat Map', url: '/map' },
  { type: 'page', id: 'reports', title: 'Reports', url: '/reports' },
  { type: 'page', id: 'settings', title: 'Settings', url: '/settings' },
];

const getIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'threat':
    case 'threat_event':
      return <AlertTriangle className="h-4 w-4" />;
    case 'alert':
      return <Bell className="h-4 w-4" />;
    case 'user':
      return <UserIcon className="h-4 w-4" />;
    case 'page':
      return <FileText className="h-4 w-4" />;
    default:
      return null;
  }
};

export function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const res = await apiRequest('GET', `/api/search?q=${encodeURIComponent(search)}`);
      return res.json();
    },
    enabled: search.length >= 2,
  });

  const handleSelect = (url: string) => {
    setOpen(false);
    setLocation(url);
  };

  const isUrlOrIp = (text: string) => {
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    return urlRegex.test(text) || ipRegex.test(text);
  };

  const getScanUrl = (text: string) => {
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(text)) {
      return `/virus-total?ip=${encodeURIComponent(text)}`;
    }
    return `/virus-total?url=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-full items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:w-64 lg:w-80"
      >
        <span className="inline-flex items-center gap-2">
          <span role="img" aria-label="Search">🔍</span>
          <span className="hidden sm:inline-block">{t('common.search', 'Search...')}</span>
        </span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder={t('search.placeholder', 'Type to search...')} 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>{t('search.noResults', 'No results found.')}</CommandEmpty>
          
          <CommandGroup heading={t('search.quickActions', 'Quick Actions')}>
             {isUrlOrIp(search) && (
               <CommandItem onSelect={() => handleSelect(getScanUrl(search))}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>{t('search.scanTarget', 'Scan Target')}: {search}</span>
               </CommandItem>
             )}
             <CommandItem onSelect={() => handleSelect('/virus-total')}>
                <Shield className="mr-2 h-4 w-4" />
                <span>{t('search.scanNow', 'Scan Now')}</span>
             </CommandItem>
             <CommandItem onSelect={() => handleSelect('/alerts')}>
                <Bell className="mr-2 h-4 w-4" />
                <span>{t('search.viewAlerts', 'View Alerts')}</span>
             </CommandItem>
             <CommandItem onSelect={() => handleSelect('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('search.updateProfile', 'Update Profile')}</span>
             </CommandItem>
          </CommandGroup>

          <CommandGroup heading={t('search.navigation', 'Navigation')}>
            {staticPages.map((page) => (
              <CommandItem
                key={page.id}
                value={page.title}
                onSelect={() => handleSelect(page.url)}
              >
                <div className="mr-2 flex h-4 w-4 items-center justify-center">
                  {getIcon(page.type)}
                </div>
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {results.length > 0 && (
            <CommandGroup heading={t('common.results', 'Results')}>
              {results.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.title} ${result.description || ''}`}
                  onSelect={() => handleSelect(result.url)}
                >
                  <div className="mr-2 flex h-4 w-4 items-center justify-center">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.description && (
                      <span className="text-xs text-muted-foreground">{result.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

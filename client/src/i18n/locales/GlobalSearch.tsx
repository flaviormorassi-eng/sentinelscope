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
import { AlertTriangle, Bell, User as UserIcon, FileText, Settings, Map } from 'lucide-react';

interface SearchResult {
  type: 'threat' | 'alert' | 'user' | 'page';
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
      return <AlertTriangle className="h-4 w-4" />;
    case 'alert':
      return <Bell className="h-4 w-4" />;
    case 'user':
      return <UserIcon className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export function GlobalSearch() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: searchResults = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', search],
    queryFn: async () => {
      if (!search) return staticPages;
      const dynamicResults = await apiRequest('GET', `/api/search?q=${search}`);
      const filteredPages = staticPages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
      return [...filteredPages, ...dynamicResults];
    },
    enabled: open,
  });

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

  const handleSelect = (url: string) => {
    setLocation(url);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground border rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Search...
        <kbd className="pointer-events-none ml-4 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {isLoading && <CommandEmpty>Loading...</CommandEmpty>}
          {!isLoading && searchResults.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
          
          <CommandGroup heading="Pages">
            {searchResults.filter(r => r.type === 'page').map((result) => (
              <CommandItem key={result.id} onSelect={() => handleSelect(result.url)}>
                {getIcon(result.type)}
                <span>{result.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {searchResults.some(r => r.type === 'threat') && (
            <CommandGroup heading="Threats">
              {searchResults.filter(r => r.type === 'threat').map((result) => (
                <CommandItem key={result.id} onSelect={() => handleSelect(result.url)}>
                  {getIcon(result.type)}
                  <span>{result.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults.some(r => r.type === 'alert') && (
            <CommandGroup heading="Alerts">
              {searchResults.filter(r => r.type === 'alert').map((result) => (
                <CommandItem key={result.id} onSelect={() => handleSelect(result.url)}>
                  {getIcon(result.type)}
                  <span>{result.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults.some(r => r.type === 'user') && (
            <CommandGroup heading="Users">
              {searchResults.filter(r => r.type === 'user').map((result) => (
                <CommandItem key={result.id} onSelect={() => handleSelect(result.url)}>
                  {getIcon(result.type)}
                  <span>{result.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
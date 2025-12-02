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
    case 'page':
      return <FileText className="h-4 w-4" />;
    default:
      return null;
  }
};

export function GlobalSearch() {
  // TODO: Implement search logic
  return (
    <div className="global-search-placeholder" style={{ display: 'inline-block', minWidth: 32 }}>
      <span role="img" aria-label="Search">🔍</span>
    </div>
  );
}

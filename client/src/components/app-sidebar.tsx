import { Shield, LayoutDashboard, AlertTriangle, Map, FileText, CreditCard, Settings, LogOut, Scan, Users, Activity, ShieldCheck, Database, BookOpen, Globe } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';

const menuItems = [
  { title: 'nav.dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'nav.threats', url: '/threats', icon: AlertTriangle },
  { title: 'nav.map', url: '/map', icon: Map },
  { title: 'nav.networkActivity', url: '/network-activity', icon: Globe },
  { title: 'nav.virustotal', url: '/virustotal', icon: Scan },
  { title: 'nav.eventSources', url: '/event-sources', icon: Database },
  { title: 'nav.installGuide', url: '/install-guide', icon: BookOpen },
  { title: 'nav.reports', url: '/reports', icon: FileText },
  { title: 'nav.subscription', url: '/subscription', icon: CreditCard },
  { title: 'nav.settings', url: '/settings', icon: Settings },
];

const adminMenuItems = [
  { title: 'nav.adminDashboard', url: '/admin', icon: ShieldCheck },
  { title: 'nav.userManagement', url: '/admin/users', icon: Users },
  { title: 'nav.systemAnalytics', url: '/admin/analytics', icon: Activity },
  { title: 'nav.compliance', url: '/admin/compliance', icon: Shield },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const { data: currentUser } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  const isAdmin = currentUser?.isAdmin || false;

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-2 px-4 py-6">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-lg font-bold">{t('app.name')}</h1>
              <p className="text-xs text-muted-foreground">{t('app.tagline')}</p>
            </div>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => setLocation(item.url)}
                    isActive={location === item.url}
                    data-testid={`nav-${item.url === '/' ? 'dashboard' : item.url.slice(1)}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.title)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{t('nav.adminPanel')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        onClick={() => setLocation(item.url)}
                        isActive={location === item.url}
                        data-testid={`nav-${item.url.replace('/admin', 'admin').replace('/', '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.title)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback>
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start"
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('auth.logout')}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

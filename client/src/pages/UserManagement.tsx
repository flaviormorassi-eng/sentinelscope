import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Edit, Shield, Lock, Activity } from 'lucide-react';
import { User, SUBSCRIPTION_TIERS, SecurityAuditLog } from '@shared/schema';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UserManagement() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mfaResetUser, setMfaResetUser] = useState<User | null>(null);
  const [viewingLogsUser, setViewingLogsUser] = useState<User | null>(null);

  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (!userLoading && currentUser && !currentUser.isAdmin) {
      setLocation('/');
    }
  }, [userLoading, currentUser, setLocation]);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: currentUser?.isAdmin === true,
  });

  const { data: userLogs = [], isLoading: logsLoading } = useQuery<SecurityAuditLog[]>({
    queryKey: [`/api/admin/users/${viewingLogsUser?.id}/logs`],
    enabled: !!viewingLogsUser,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<User> }) => {
      return await apiRequest('PUT', `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditingUser(null);
      toast({
        title: t('admin.userUpdated'),
        description: t('admin.userUpdatedSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  const resetMfaMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/reset-mfa`);
    },
    onSuccess: () => {
      setMfaResetUser(null);
      toast({
        title: "MFA Reset Successful",
        description: "The user's MFA settings have been cleared. They can now set up MFA again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset MFA',
        variant: 'destructive',
      });
    },
  });

  if (userLoading || !currentUser) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return null;
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(search.toLowerCase()));
    
    return matchesSearch;
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedTier(user.subscriptionTier);
    setSelectedStatus(user.subscriptionStatus || 'inactive');
    setIsAdmin(user.isAdmin);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    updateUserMutation.mutate({
      id: editingUser.id,
      updates: {
        subscriptionTier: selectedTier,
        subscriptionStatus: selectedStatus,
        isAdmin,
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.userManagement')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('admin.manageUsers')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.searchUsers')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <div className="text-sm text-muted-foreground flex items-center">
              {filteredUsers.length} {t('admin.usersFound')}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.email')}</TableHead>
                  <TableHead>{t('admin.displayName')}</TableHead>
                  <TableHead className="w-[140px]">{t('admin.subscription')}</TableHead>
                  <TableHead className="w-[100px]">{t('admin.adminStatus')}</TableHead>
                  <TableHead className="w-[140px]">{t('admin.createdAt')}</TableHead>
                  <TableHead className="w-[100px]">{t('admin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.displayName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          user.subscriptionTier === 'enterprise' ? 'default' :
                          user.subscriptionTier === 'smb' ? 'secondary' : 'outline'
                        }>
                          {SUBSCRIPTION_TIERS[user.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS].name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge variant="destructive" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(user.createdAt), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('admin.noUsers')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>{t('admin.editUser')}</DialogTitle>
            <DialogDescription>
              {t('admin.editUserDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('admin.email')}</Label>
                <Input
                  id="email"
                  value={editingUser.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription">{t('admin.subscription')}</Label>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger id="subscription" data-testid="select-subscription">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual - $5.00/mo</SelectItem>
                    <SelectItem value="smb">Small Business - $49.99/mo</SelectItem>
                    <SelectItem value="enterprise">Pro - $199.99/mo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Subscription Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Set to "Active" to grant access without Stripe payment (e.g. for complimentary accounts).
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-md">
                <div>
                  <Label htmlFor="admin-toggle" className="font-medium">{t('admin.adminStatus')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.grantAdminAccess')}
                  </p>
                </div>
                <Button
                  id="admin-toggle"
                  variant={isAdmin ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setIsAdmin(!isAdmin)}
                  data-testid="button-toggle-admin"
                >
                  {isAdmin ? (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </>
                  ) : (
                    'User'
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-md border-destructive/20 bg-destructive/5">
                <div>
                  <Label className="font-medium text-destructive">Emergency MFA Reset</Label>
                  <p className="text-sm text-muted-foreground">
                    Clear all MFA factors for this user.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setMfaResetUser(editingUser)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Reset MFA
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-md">
                <div>
                  <Label className="font-medium">Activity Logs</Label>
                  <p className="text-sm text-muted-foreground">
                    View recent security events for this user.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingLogsUser(editingUser)}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  View Logs
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              data-testid="button-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLogsUser} onOpenChange={(open) => !open && setViewingLogsUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Activity Logs: {viewingLogsUser?.email}</DialogTitle>
            <DialogDescription>
              Recent security events and actions performed by this user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ) : userLogs.length > 0 ? (
                  userLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium">{log.eventType}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'outline' : 'destructive'}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.ipAddress || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No recent activity logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!mfaResetUser} onOpenChange={(open) => !open && setMfaResetUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset MFA for {mfaResetUser?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The user will be required to set up Multi-Factor Authentication again on their next login.
              Use this only if the user has lost access to their authentication device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => mfaResetUser && resetMfaMutation.mutate(mfaResetUser.id)}
            >
              {resetMfaMutation.isPending ? "Resetting..." : "Yes, Reset MFA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

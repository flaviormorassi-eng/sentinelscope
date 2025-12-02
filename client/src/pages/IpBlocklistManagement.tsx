import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Trash2, Shield, Upload, PlusCircle, Loader2 } from 'lucide-react';
import { IpBlocklistEntry, User } from '@shared/schema';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 10;

export default function IpBlocklistManagement() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isAddIpDialogOpen, setIsAddIpDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (!userLoading && currentUser && !currentUser.isAdmin) {
      setLocation('/');
    }
  }, [userLoading, currentUser, setLocation]);

  const { data, isLoading } = useQuery<{ entries: IpBlocklistEntry[], total: number }>({
    queryKey: ['/api/admin/ip-blocklist', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        search: search,
      });
      return apiRequest('GET', `/api/admin/ip-blocklist?${params.toString()}`);
    },
    enabled: currentUser?.isAdmin === true,
    placeholderData: (previousData) => previousData,
  });

  const ipBlocklist = data?.entries || [];
  const totalEntries = data?.total || 0;
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE);

  const removeIpMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/admin/ip-blocklist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ip-blocklist'] });
      toast({ title: 'Success', description: 'IP removed from blocklist.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest('POST', '/api/admin/ip-blocklist/bulk', formData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ip-blocklist'] });
      setIsBulkImportDialogOpen(false);
      toast({
        title: 'Bulk Import Successful',
        description: `${data.addedCount} IPs were added to the blocklist.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Import Failed',
        description: error.message || 'An error occurred during the bulk import.',
        variant: 'destructive',
      });
    },
  });

  if (userLoading || !currentUser?.isAdmin) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">IP Blocklist Management</h1>
        <p className="text-muted-foreground mt-2">
          View, search, and manage all blocked IP addresses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by IP address or reason..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsBulkImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t('admin.bulkImport')}
              </Button>
              <Button onClick={() => setIsAddIpDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {t('admin.addIp')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Added At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(PAGE_SIZE)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : ipBlocklist.length > 0 ? (
                  ipBlocklist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono flex items-center gap-2">
                        {entry.countryCode && (
                          <img src={`https://flagcdn.com/w20/${entry.countryCode.toLowerCase()}.png`} alt={entry.countryCode} className="h-4 rounded-sm" />
                        )}
                        {entry.ipAddress}
                      </TableCell>
                      <TableCell>{entry.reason || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {entry.addedBy === 'system' ? <Shield className="h-4 w-4 text-primary" aria-label="System (Auto-blocked)" /> : entry.addedBy?.slice(0, 8) + '...'}
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIpMutation.mutate(entry.id)}
                          disabled={removeIpMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No IPs found on the blocklist.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page === 1) return;
                      setPage(Math.max(1, page - 1));
                    }}
                    aria-disabled={page === 1}
                    className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page === totalPages) return;
                      setPage(Math.min(totalPages, page + 1));
                    }}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportDialogOpen} onOpenChange={setIsBulkImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.bulkImport')}</DialogTitle>
            <DialogDescription>
              {t('admin.bulkImportDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('admin.csvFormatInstructions')}
            </p>
            <pre className="bg-muted p-3 rounded-md text-xs">
              <code>
                ip_address,reason<br />
                1.2.3.4,Known attacker<br />
                5.6.7.8,Spam source
              </code>
            </pre>
            <div className="space-y-2">
              <Label htmlFor="csv-file">{t('admin.csvFile')}</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (fileInputRef.current?.files?.[0]) {
                  bulkImportMutation.mutate(fileInputRef.current.files[0]);
                }
              }}
              disabled={bulkImportMutation.isPending}
            >
              {bulkImportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('admin.import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
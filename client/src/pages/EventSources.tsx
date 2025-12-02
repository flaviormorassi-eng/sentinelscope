import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Trash2, Copy, Check, Activity, AlertCircle, Database, Server, Globe } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const createSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  sourceType: z.enum(['syslog', 'api', 'agent', 'webhook']),
  description: z.string().max(500, 'Description too long').optional(),
});

type CreateSourceInput = z.infer<typeof createSourceSchema>;

interface EventSource {
  id: string;
  userId: string;
  name: string;
  sourceType: string;
  description: string | null;
  isActive: boolean;
  lastHeartbeat: string | null;
  createdAt: string;
  rotationExpiresAt?: string | null;
  secondaryApiKeyHash?: string | null; // presence implies rotation window active until expiry
}

const sourceTypeIcons = {
  syslog: Database,
  api: Server,
  agent: Activity,
  webhook: Globe,
};

function RotationStatus({ sources }: { sources: EventSource[] }) {
  // Find sources with active rotation window
  const activeRotations = sources.filter(s => s.secondaryApiKeyHash && s.rotationExpiresAt && new Date(s.rotationExpiresAt) > new Date());
  if (activeRotations.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {activeRotations.map(src => {
        const expires = new Date(src.rotationExpiresAt!);
        const remainingMs = expires.getTime() - Date.now();
        const remainingHours = remainingMs / 3600_000;
        const remainingStr = remainingHours > 1 ? `${remainingHours.toFixed(1)}h` : `${Math.max(0, Math.floor(remainingMs / 60000))}m`;
        return (
          <div key={src.id} className="text-xs flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 dark:border-amber-700/40 rounded px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-medium">API key rotation in progress for "{src.name}"</span>
            <span className="text-amber-700 dark:text-amber-400">(expires in {remainingStr})</span>
          </div>
        );
      })}
    </div>
  );
}

export default function EventSources() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);

  const form = useForm<CreateSourceInput>({
    resolver: zodResolver(createSourceSchema),
    defaultValues: {
      name: '',
      sourceType: 'syslog',
      description: '',
    },
  });

  const { data: sources = [], isLoading } = useQuery<EventSource[]>({
    queryKey: ['/api/event-sources'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSourceInput) => {
      return await apiRequest('POST', '/api/event-sources', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-sources'] });
      setNewApiKey(data.apiKey);
      setApiKeyDialogOpen(true);
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: t('eventSources.created'),
        description: 'Event source created successfully. Save your API key now!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event source',
        variant: 'destructive',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest('POST', `/api/event-sources/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-sources'] });
      toast({
        title: t('eventSources.updated'),
        description: 'Event source status updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event source',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/event-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-sources'] });
      setDeleteSourceId(null);
      toast({
        title: t('eventSources.deleted'),
        description: 'Event source deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event source',
        variant: 'destructive',
      });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async ({ id, graceSeconds }: { id: string; graceSeconds?: number }) => {
      return await apiRequest('POST', `/api/event-sources/${id}/rotate`, graceSeconds != null ? { graceSeconds } : {});
    },
    onSuccess: (data: any) => {
      // Show the newly generated API key once
      if (data?.apiKey) {
        setNewApiKey(data.apiKey);
        setApiKeyDialogOpen(true);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/event-sources'] });
      toast({ title: t('eventSources.updated'), description: 'API key rotated successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to rotate API key', variant: 'destructive' });
    },
  });

  const forceExpireMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return await apiRequest('POST', `/api/event-sources/${id}/rotation/expire`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-sources'] });
      toast({ title: t('eventSources.updated'), description: 'Rotation window force-expired.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to force-expire rotation', variant: 'destructive' });
    },
  });

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(newApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({
      title: 'Copied!',
      description: 'API key copied to clipboard',
    });
  };

  const onSubmit = (data: CreateSourceInput) => {
    createMutation.mutate(data);
  };

  const getSourceTypeLabel = (type: string) => {
    const labels = {
      syslog: 'Syslog',
      api: 'API',
      agent: 'Agent',
      webhook: 'Webhook',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getSourceTypeColor = (type: string) => {
    const colors = {
      syslog: 'bg-blue-500/10 text-blue-500',
      api: 'bg-green-500/10 text-green-500',
      agent: 'bg-purple-500/10 text-purple-500',
      webhook: 'bg-orange-500/10 text-orange-500',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500/10 text-gray-500';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t('eventSources.title')}
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-page-description">
            {t('eventSources.description')}
          </p>
          <RotationStatus sources={sources} />
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-source">
              <Plus className="w-4 h-4 mr-2" />
              {t('eventSources.createNew')}
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-source">
            <DialogHeader>
              <DialogTitle>{t('eventSources.createNew')}</DialogTitle>
              <DialogDescription>
                {t('eventSources.createDescription')}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Production Firewall"
                          data-testid="input-source-name"
                        />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for this event source
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source-type">
                            <SelectValue placeholder="Select a source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="syslog" data-testid="option-syslog">Syslog Server</SelectItem>
                          <SelectItem value="api" data-testid="option-api">REST API</SelectItem>
                          <SelectItem value="agent" data-testid="option-agent">Agent</SelectItem>
                          <SelectItem value="webhook" data-testid="option-webhook">Webhook</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How this source will send events
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Firewall events from production network..."
                          data-testid="input-source-description"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Source'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Key Display Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent data-testid="dialog-api-key">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This is the only time you'll see this API key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">API Key</p>
              <code className="font-mono text-sm break-all" data-testid="text-api-key">
                {newApiKey}
              </code>
            </div>
            <Button
              onClick={handleCopyApiKey}
              className="w-full"
              data-testid="button-copy-api-key"
            >
              {copiedKey ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setApiKeyDialogOpen(false);
                setNewApiKey('');
                setCopiedKey(false);
              }}
              data-testid="button-close-api-key-dialog"
            >
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSourceId} onOpenChange={() => setDeleteSourceId(null)}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Source?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All events from this source will remain, but you won't be able to receive new events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSourceId && deleteMutation.mutate(deleteSourceId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sources Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <Card data-testid="card-empty-state">
          <CardContent className="py-12 text-center">
            <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Event Sources</h3>
            <p className="text-muted-foreground mb-4">
              Create your first event source to start receiving real-time security events
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-source">
              <Plus className="w-4 h-4 mr-2" />
              Create Event Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="grid-sources">
          {sources.map((source) => {
            const Icon = sourceTypeIcons[source.sourceType as keyof typeof sourceTypeIcons] || Database;
            return (
              <Card key={source.id} data-testid={`card-source-${source.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getSourceTypeColor(source.sourceType)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-source-name-${source.id}`}>
                          {source.name}
                        </CardTitle>
                        <Badge variant="outline" className="mt-1" data-testid={`badge-source-type-${source.id}`}>
                          {getSourceTypeLabel(source.sourceType)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {source.description && (
                    <CardDescription className="mt-2" data-testid={`text-source-description-${source.id}`}>
                      {source.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${source.id}`} className="text-sm">
                        Active
                      </Label>
                      <Switch
                        id={`active-${source.id}`}
                        checked={source.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: source.id, isActive: checked })
                        }
                        disabled={toggleMutation.isPending}
                        data-testid={`switch-active-${source.id}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => rotateMutation.mutate({ id: source.id })}
                        disabled={rotateMutation.isPending}
                        data-testid={`button-rotate-${source.id}`}
                      >
                        {t('eventSources.rotateKey')}
                      </Button>
                      {source.secondaryApiKeyHash && source.rotationExpiresAt && new Date(source.rotationExpiresAt) > new Date() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forceExpireMutation.mutate({ id: source.id })}
                          disabled={forceExpireMutation.isPending}
                          data-testid={`button-force-expire-${source.id}`}
                        >
                          {t('eventSources.forceExpire')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteSourceId(source.id)}
                        data-testid={`button-delete-${source.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p data-testid={`text-created-${source.id}`}>
                      Created: {formatDate(source.createdAt)}
                    </p>
                    {source.lastHeartbeat && (
                      <p className="flex items-center gap-1" data-testid={`text-heartbeat-${source.id}`}>
                        <Activity className="w-3 h-3" />
                        Last seen: {formatDate(source.lastHeartbeat)}
                      </p>
                    )}
                    {source.secondaryApiKeyHash && source.rotationExpiresAt && new Date(source.rotationExpiresAt) > new Date() && (
                      <p className="flex items-center gap-1" data-testid={`text-rotation-${source.id}`}>
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Rotating keys – expires {new Date(source.rotationExpiresAt).toLocaleTimeString()} ({Math.max(0, Math.floor((new Date(source.rotationExpiresAt).getTime() - Date.now())/60000))}m remaining)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

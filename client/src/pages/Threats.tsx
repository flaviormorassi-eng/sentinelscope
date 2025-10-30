import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Search, Filter } from 'lucide-react';
import { Threat } from '@shared/schema';
import { format } from 'date-fns';

export default function Threats() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: threats = [], isLoading } = useQuery<Threat[]>({
    queryKey: ['/api/threats'],
  });

  const filteredThreats = threats.filter((threat) => {
    const matchesSearch = 
      threat.sourceIP.toLowerCase().includes(search.toLowerCase()) ||
      threat.description.toLowerCase().includes(search.toLowerCase()) ||
      threat.type.toLowerCase().includes(search.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || threat.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || threat.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Severity', 'Type', 'Source IP', 'Target IP', 'Status', 'Description'],
      ...filteredThreats.map(t => [
        format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        t.severity,
        t.type,
        t.sourceIP,
        t.targetIP,
        t.status,
        t.description
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threats-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('threats.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('threats.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-threats"
              />
            </div>
            <div className="flex gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-severity-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('threats.severity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">{t('threats.severityLevels.critical')}</SelectItem>
                  <SelectItem value="high">{t('threats.severityLevels.high')}</SelectItem>
                  <SelectItem value="medium">{t('threats.severityLevels.medium')}</SelectItem>
                  <SelectItem value="low">{t('threats.severityLevels.low')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder={t('threats.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="detected">{t('threats.statuses.detected')}</SelectItem>
                  <SelectItem value="blocked">{t('threats.statuses.blocked')}</SelectItem>
                  <SelectItem value="analyzing">{t('threats.statuses.analyzing')}</SelectItem>
                  <SelectItem value="resolved">{t('threats.statuses.resolved')}</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleExport} variant="outline" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                {t('threats.export')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">{t('threats.timestamp')}</TableHead>
                  <TableHead className="w-[100px]">{t('threats.severity')}</TableHead>
                  <TableHead>{t('threats.type')}</TableHead>
                  <TableHead className="w-[140px]">{t('threats.source')}</TableHead>
                  <TableHead className="w-[140px]">{t('threats.target')}</TableHead>
                  <TableHead className="w-[100px]">{t('threats.status')}</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredThreats.length > 0 ? (
                  filteredThreats.map((threat) => (
                    <TableRow key={threat.id} data-testid={`row-threat-${threat.id}`}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(threat.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                          {t(`threats.severityLevels.${threat.severity}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{t(`threats.types.${threat.type}`)}</TableCell>
                      <TableCell className="font-mono text-xs">{threat.sourceIP}</TableCell>
                      <TableCell className="font-mono text-xs">{threat.targetIP}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(`threats.statuses.${threat.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{threat.description}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('threats.noThreats')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

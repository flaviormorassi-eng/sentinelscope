import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function Reports() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reportType, setReportType] = useState('summary');
  const [period, setPeriod] = useState('day');
  const [format, setFormat] = useState('pdf');

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/reports/generate', {
        type: reportType,
        period,
        format,
      });
      return response;
    },
    onSuccess: (data: any) => {
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || `report-${Date.now()}.${format}`;
        link.click();
      }
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('reports.title')}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('reports.generate')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="report-type">{t('reports.type')}</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type" data-testid="select-report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">{t('reports.types.summary')}</SelectItem>
                  <SelectItem value="detailed">{t('reports.types.detailed')}</SelectItem>
                  <SelectItem value="compliance">{t('reports.types.compliance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">{t('reports.period')}</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger id="period" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t('reports.periods.day')}</SelectItem>
                  <SelectItem value="week">{t('reports.periods.week')}</SelectItem>
                  <SelectItem value="month">{t('reports.periods.month')}</SelectItem>
                  <SelectItem value="custom">{t('reports.periods.custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">{t('reports.format')}</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format" data-testid="select-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-report"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('reports.generating')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('reports.generate')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h3 className="font-medium mb-2">
                  {t(`reports.types.${reportType}`)}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t(`reports.periods.${period}`)}
                </p>
                <div className="space-y-2 text-sm">
                  <p className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-mono uppercase">{format}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Includes:</span>
                    <span>
                      {reportType === 'summary' && 'Overview, statistics'}
                      {reportType === 'detailed' && 'Full threat analysis'}
                      {reportType === 'compliance' && 'Compliance metrics'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2 text-sm">Report Contents</h4>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• Executive Summary</li>
                  <li>• Threat Statistics & Trends</li>
                  <li>• Security Incident Timeline</li>
                  <li>• Attack Vector Analysis</li>
                  <li>• Geographic Distribution</li>
                  <li>• Recommendations & Action Items</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, FileSearch, Link as LinkIcon, Network, Loader2, ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSearch } from "wouter";

interface VirusTotalResult {
  status: 'clean' | 'malicious' | 'suspicious' | 'undetected' | 'error';
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total: number;
  permalink?: string;
  analysisDate?: string;
  error?: string;
}

export default function VirusTotalScan() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchString = useSearch();
  const [fileHash, setFileHash] = useState("");
  const [url, setUrl] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [result, setResult] = useState<VirusTotalResult | null>(null);
  const [activeTab, setActiveTab] = useState("hash");

  const checkHashMutation = useMutation({
    mutationFn: async (hash: string) => {
      return apiRequest("POST", "/api/virustotal/check-hash", { hash }) as Promise<VirusTotalResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: t('virustotal.toast.scanComplete'),
        description: t('virustotal.toast.hashAnalyzed', { status: data.status }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('virustotal.toast.scanFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkURLMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("POST", "/api/virustotal/check-url", { url }) as Promise<VirusTotalResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: t('virustotal.toast.scanComplete'),
        description: t('virustotal.toast.urlAnalyzed', { status: data.status }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('virustotal.toast.scanFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkIPMutation = useMutation({
    mutationFn: async (ip: string) => {
      return apiRequest("POST", "/api/virustotal/check-ip", { ip }) as Promise<VirusTotalResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: t('virustotal.toast.scanComplete'),
        description: t('virustotal.toast.ipAnalyzed', { status: data.status }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('virustotal.toast.scanFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlParam = params.get("url");
    const ipParam = params.get("ip");
    const hashParam = params.get("hash");

    if (urlParam) {
      setActiveTab("url");
      setUrl(urlParam);
      checkURLMutation.mutate(urlParam);
    } else if (ipParam) {
      setActiveTab("ip");
      setIpAddress(ipParam);
      checkIPMutation.mutate(ipParam);
    } else if (hashParam) {
      setActiveTab("hash");
      setFileHash(hashParam);
      checkHashMutation.mutate(hashParam);
    }
  }, [searchString]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      clean: "default",
      malicious: "destructive",
      suspicious: "secondary",
      undetected: "outline",
      error: "destructive",
    };
    return (
      <Badge variant={variants[status]} className="text-sm">
        {t(`virustotal.status.${status}`)}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t('virustotal.title')}</h1>
          <p className="text-muted-foreground">{t('virustotal.description')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hash" data-testid="tab-file-hash">
            <FileSearch className="h-4 w-4 mr-2" />
            {t('virustotal.tabs.hash')}
          </TabsTrigger>
          <TabsTrigger value="url" data-testid="tab-url">
            <LinkIcon className="h-4 w-4 mr-2" />
            {t('virustotal.tabs.url')}
          </TabsTrigger>
          <TabsTrigger value="ip" data-testid="tab-ip">
            <Network className="h-4 w-4 mr-2" />
            {t('virustotal.tabs.ip')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hash" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('virustotal.scan.hashTitle')}</CardTitle>
              <CardDescription>
                {t('virustotal.scan.hashDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-hash">{t('virustotal.scan.hashLabel')}</Label>
                <Input
                  id="file-hash"
                  data-testid="input-file-hash"
                  placeholder={t('virustotal.scan.hashPlaceholder')}
                  value={fileHash}
                  onChange={(e) => setFileHash(e.target.value)}
                />
              </div>
              <Button
                data-testid="button-scan-hash"
                onClick={() => checkHashMutation.mutate(fileHash)}
                disabled={!fileHash || checkHashMutation.isPending}
                className="w-full"
              >
                {checkHashMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('virustotal.scan.hashButton')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('virustotal.scan.urlTitle')}</CardTitle>
              <CardDescription>
                {t('virustotal.scan.urlDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">{t('virustotal.scan.urlLabel')}</Label>
                <Input
                  id="url"
                  data-testid="input-url"
                  type="url"
                  placeholder={t('virustotal.scan.urlPlaceholder')}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button
                data-testid="button-scan-url"
                onClick={() => checkURLMutation.mutate(url)}
                disabled={!url || checkURLMutation.isPending}
                className="w-full"
              >
                {checkURLMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('virustotal.scan.urlButton')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('virustotal.scan.ipTitle')}</CardTitle>
              <CardDescription>
                {t('virustotal.scan.ipDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ip">{t('virustotal.scan.ipLabel')}</Label>
                <Input
                  id="ip"
                  data-testid="input-ip"
                  placeholder={t('virustotal.scan.ipPlaceholder')}
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                />
              </div>
              <Button
                data-testid="button-scan-ip"
                onClick={() => checkIPMutation.mutate(ipAddress)}
                disabled={!ipAddress || checkIPMutation.isPending}
                className="w-full"
              >
                {checkIPMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('virustotal.scan.ipButton')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('virustotal.results.title')}</span>
              {getStatusBadge(result.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error ? (
              <p className="text-destructive" data-testid="text-error">{result.error}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('virustotal.results.malicious')}</p>
                    <p className="text-2xl font-bold text-destructive" data-testid="text-malicious">
                      {result.malicious}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('virustotal.results.suspicious')}</p>
                    <p className="text-2xl font-bold text-yellow-500" data-testid="text-suspicious">
                      {result.suspicious}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('virustotal.results.harmless')}</p>
                    <p className="text-2xl font-bold text-green-500" data-testid="text-harmless">
                      {result.harmless}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('virustotal.results.undetected')}</p>
                    <p className="text-2xl font-bold text-muted-foreground" data-testid="text-undetected">
                      {result.undetected}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {t('virustotal.results.totalEngines')}: <span className="font-semibold" data-testid="text-total">{result.total}</span>
                  </p>
                  {result.analysisDate && (
                    <p className="text-sm text-muted-foreground">
                      {t('virustotal.results.lastAnalysis')}: <span className="font-semibold">{new Date(result.analysisDate).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                {result.permalink && (
                  <Button
                    data-testid="button-view-report"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(result.permalink, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('virustotal.results.viewReport')}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

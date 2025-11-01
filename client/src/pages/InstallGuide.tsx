import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Monitor, Terminal, Download, Key, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function InstallGuide() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, commandId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(commandId);
    toast({
      title: t("common.copied"),
      description: t("install.commandCopied"),
    });
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const replitUrl = window.location.origin;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-install-title">
            {t("install.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-install-description">
            {t("install.description")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {t("install.beforeYouBegin")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">1</Badge>
                <div>
                  <p className="font-medium">{t("install.step1Title")}</p>
                  <p className="text-sm text-muted-foreground">{t("install.step1Description")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">2</Badge>
                <div>
                  <p className="font-medium">{t("install.step2Title")}</p>
                  <p className="text-sm text-muted-foreground">{t("install.step2Description")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">3</Badge>
                <div>
                  <p className="font-medium">{t("install.step3Title")}</p>
                  <p className="text-sm text-muted-foreground">{t("install.step3Description")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              {t("install.getApiKey")}
            </CardTitle>
            <CardDescription>{t("install.apiKeyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>{t("install.apiStep1")}</li>
              <li>{t("install.apiStep2")}</li>
              <li>{t("install.apiStep3")}</li>
              <li>{t("install.apiStep4")}</li>
            </ol>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("install.apiKeyWarning")}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              {t("install.installationSteps")}
            </CardTitle>
            <CardDescription>{t("install.installationDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="windows" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="windows" data-testid="tab-windows">
                  <Monitor className="w-4 h-4 mr-2" />
                  Windows
                </TabsTrigger>
                <TabsTrigger value="mac" data-testid="tab-mac">
                  <Monitor className="w-4 h-4 mr-2" />
                  macOS
                </TabsTrigger>
                <TabsTrigger value="linux" data-testid="tab-linux">
                  <Monitor className="w-4 h-4 mr-2" />
                  Linux
                </TabsTrigger>
              </TabsList>

              <TabsContent value="windows" className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">{t("install.windowsTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("install.windowsDescription")}</p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 1: {t("install.downloadAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>Invoke-WebRequest -Uri "{replitUrl}/downloads/sentinel-agent-windows.exe" -OutFile "sentinel-agent.exe"</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`Invoke-WebRequest -Uri "${replitUrl}/downloads/sentinel-agent-windows.exe" -OutFile "sentinel-agent.exe"`, "win-download")}
                          data-testid="button-copy-win-download"
                        >
                          {copiedCommand === "win-download" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 2: {t("install.configureAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>./sentinel-agent.exe configure --api-key YOUR_API_KEY --endpoint {replitUrl}/api/ingest/events</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`./sentinel-agent.exe configure --api-key YOUR_API_KEY --endpoint ${replitUrl}/api/ingest/events`, "win-config")}
                          data-testid="button-copy-win-config"
                        >
                          {copiedCommand === "win-config" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 3: {t("install.startAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>./sentinel-agent.exe install-service{'\n'}Start-Service SentinelAgent</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard('./sentinel-agent.exe install-service\nStart-Service SentinelAgent', "win-start")}
                          data-testid="button-copy-win-start"
                        >
                          {copiedCommand === "win-start" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mac" className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">{t("install.macTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("install.macDescription")}</p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 1: {t("install.downloadAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>curl -o sentinel-agent "{replitUrl}/downloads/sentinel-agent-macos"</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`curl -o sentinel-agent "${replitUrl}/downloads/sentinel-agent-macos"`, "mac-download")}
                          data-testid="button-copy-mac-download"
                        >
                          {copiedCommand === "mac-download" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 2: {t("install.makeExecutable")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>chmod +x sentinel-agent</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard('chmod +x sentinel-agent', "mac-chmod")}
                          data-testid="button-copy-mac-chmod"
                        >
                          {copiedCommand === "mac-chmod" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 3: {t("install.configureAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>sudo ./sentinel-agent configure --api-key YOUR_API_KEY --endpoint {replitUrl}/api/ingest/events</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`sudo ./sentinel-agent configure --api-key YOUR_API_KEY --endpoint ${replitUrl}/api/ingest/events`, "mac-config")}
                          data-testid="button-copy-mac-config"
                        >
                          {copiedCommand === "mac-config" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 4: {t("install.startAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>sudo ./sentinel-agent start</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard('sudo ./sentinel-agent start', "mac-start")}
                          data-testid="button-copy-mac-start"
                        >
                          {copiedCommand === "mac-start" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="linux" className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">{t("install.linuxTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("install.linuxDescription")}</p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 1: {t("install.downloadAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>wget {replitUrl}/downloads/sentinel-agent-linux -O sentinel-agent</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`wget ${replitUrl}/downloads/sentinel-agent-linux -O sentinel-agent`, "linux-download")}
                          data-testid="button-copy-linux-download"
                        >
                          {copiedCommand === "linux-download" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 2: {t("install.makeExecutable")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>chmod +x sentinel-agent</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard('chmod +x sentinel-agent', "linux-chmod")}
                          data-testid="button-copy-linux-chmod"
                        >
                          {copiedCommand === "linux-chmod" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 3: {t("install.configureAgent")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>sudo ./sentinel-agent configure --api-key YOUR_API_KEY --endpoint {replitUrl}/api/ingest/events</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`sudo ./sentinel-agent configure --api-key YOUR_API_KEY --endpoint ${replitUrl}/api/ingest/events`, "linux-config")}
                          data-testid="button-copy-linux-config"
                        >
                          {copiedCommand === "linux-config" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">{t("install.step")} 4: {t("install.installSystemd")}</p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          <code>sudo ./sentinel-agent install-systemd{'\n'}sudo systemctl enable sentinel-agent{'\n'}sudo systemctl start sentinel-agent</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard('sudo ./sentinel-agent install-systemd\nsudo systemctl enable sentinel-agent\nsudo systemctl start sentinel-agent', "linux-start")}
                          data-testid="button-copy-linux-start"
                        >
                          {copiedCommand === "linux-start" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {t("install.verifyInstallation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("install.verifyDescription")}</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>{t("install.verifyStep1")}</li>
              <li>{t("install.verifyStep2")}</li>
              <li>{t("install.verifyStep3")}</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              {t("install.troubleshooting")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-sm">{t("install.troubleNoEvents")}</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                <li>{t("install.troubleCheckApiKey")}</li>
                <li>{t("install.troubleCheckFirewall")}</li>
                <li>{t("install.troubleCheckService")}</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-sm">{t("install.troublePermission")}</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                <li>{t("install.troubleRunAsAdmin")}</li>
                <li>{t("install.troubleCheckPermissions")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

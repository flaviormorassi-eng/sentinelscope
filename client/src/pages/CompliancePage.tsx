import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, FileCheck, Database, Lock, Eye, Users, Globe } from 'lucide-react';

export default function CompliancePage() {
  const { t } = useTranslation();

  const certifications = [
    {
      icon: FileCheck,
      title: 'SOC 2 Type II',
      status: t('compliance.certifications.soc2.status', 'Ready'),
      description: t('compliance.certifications.soc2.description', 'Comprehensive security controls for availability, processing integrity, confidentiality, and privacy.'),
    },
    {
      icon: Lock,
      title: 'ISO 27001',
      status: t('compliance.certifications.iso.status', 'Compliant'),
      description: t('compliance.certifications.iso.description', 'Information security management system with rigorous security controls and audit procedures.'),
    },
    {
      icon: Globe,
      title: 'GDPR',
      status: t('compliance.certifications.gdpr.status', 'Compliant'),
      description: t('compliance.certifications.gdpr.description', 'Full compliance with EU General Data Protection Regulation including data portability and right to deletion.'),
    },
  ];

  const controls = [
    {
      category: t('compliance.controls.access.title', 'Access Control'),
      items: [
        t('compliance.controls.access.rbac', 'Role-Based Access Control (RBAC)'),
        t('compliance.controls.access.ownership', 'Ownership verification on all operations'),
        t('compliance.controls.access.mfa', 'Multi-factor authentication via Google OAuth'),
        t('compliance.controls.access.session', 'Secure session management with expiration'),
      ],
    },
    {
      category: t('compliance.controls.audit.title', 'Audit & Logging'),
      items: [
        t('compliance.controls.audit.comprehensive', 'Comprehensive audit logging of all security events'),
        t('compliance.controls.audit.auth', 'Authentication and authorization tracking'),
        t('compliance.controls.audit.data', 'Data access and modification logs'),
        t('compliance.controls.audit.config', 'Configuration change tracking'),
      ],
    },
    {
      category: t('compliance.controls.data.title', 'Data Protection'),
      items: [
        t('compliance.controls.data.encryption', 'Encryption in transit (TLS 1.3) and at rest (AES-256)'),
        t('compliance.controls.data.backup', 'Automated backups with 7-day retention'),
        t('compliance.controls.data.recovery', 'Point-in-time restore capability'),
        t('compliance.controls.data.isolation', 'Data isolation between customers'),
      ],
    },
    {
      category: t('compliance.controls.incident.title', 'Incident Response'),
      items: [
        t('compliance.controls.incident.detection', 'Real-time threat detection and alerting'),
        t('compliance.controls.incident.process', 'Documented incident response procedures'),
        t('compliance.controls.incident.notification', '72-hour breach notification process'),
        t('compliance.controls.incident.forensics', 'Security forensics and root cause analysis'),
      ],
    },
  ];

  const reports = [
    {
      icon: FileCheck,
      title: t('compliance.reports.audit.title', 'Audit Logs'),
      description: t('compliance.reports.audit.description', 'Export complete audit trails with advanced filtering by user, event type, date range, and severity.'),
      action: t('compliance.reports.audit.action', 'View Audit Logs'),
    },
    {
      icon: Database,
      title: t('compliance.reports.data.title', 'Data Export'),
      description: t('compliance.reports.data.description', 'GDPR-compliant data portability. Export all your data in machine-readable JSON format.'),
      action: t('compliance.reports.data.action', 'Export Data'),
    },
    {
      icon: Eye,
      title: t('compliance.reports.compliance.title', 'Compliance Report'),
      description: t('compliance.reports.compliance.description', 'Generate comprehensive compliance reports showing security metrics and audit statistics.'),
      action: t('compliance.reports.compliance.action', 'Generate Report'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">SentinelScope</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back', 'Back')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4" variant="outline">
              <FileCheck className="h-3 w-3 mr-1" />
              {t('compliance.hero.badge', 'SOC2 & ISO 27001 Compliant')}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t('compliance.hero.title', 'Enterprise-Grade Compliance')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('compliance.hero.description', 'SentinelScope is built with compliance in mind. We implement rigorous security controls and audit procedures to meet the strictest industry standards.')}
            </p>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('compliance.certifications.title', 'Certifications & Standards')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {certifications.map((cert, index) => (
                <Card key={index}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <cert.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{cert.title}</h3>
                    <Badge variant="secondary" className="mb-4">
                      {cert.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{cert.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Controls */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('compliance.controls.title', 'Security Controls')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {controls.map((control, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">{control.category}</h3>
                    <ul className="space-y-2">
                      {control.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Features */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('compliance.features.title', 'Compliance Features')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reports.map((report, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <report.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{report.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                    <Link href="/admin/compliance">
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-compliance-${index}`}>
                        {report.action}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Data Rights */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('compliance.rights.title', 'Your Data Rights')}
            </h2>
            <Card>
              <CardContent className="p-8 space-y-6">
                <p className="text-muted-foreground">
                  {t('compliance.rights.intro', 'Under GDPR and other privacy regulations, you have the following rights regarding your data:')}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">
                          {t('compliance.rights.access.title', 'Right to Access')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {t('compliance.rights.access.description', 'Request a copy of all your personal data we hold.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <FileCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">
                          {t('compliance.rights.rectification.title', 'Right to Rectification')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {t('compliance.rights.rectification.description', 'Correct any inaccurate or incomplete data.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <Database className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">
                          {t('compliance.rights.erasure.title', 'Right to Erasure')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {t('compliance.rights.erasure.description', 'Request deletion of your account and all associated data.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">
                          {t('compliance.rights.portability.title', 'Right to Portability')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {t('compliance.rights.portability.description', 'Export your data in a machine-readable format.')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('compliance.rights.contact', 'To exercise any of these rights, please contact our compliance team:')}
                  </p>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="font-semibold">SentinelScope Compliance Team</p>
                    <p className="text-sm text-muted-foreground">Email: contact@sentinel-scope.com</p>
                    <p className="text-sm text-muted-foreground">Response time: Within 30 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, Lock, Key, Database, Eye, FileCheck, AlertTriangle } from 'lucide-react';

export default function SecurityPage() {
  const { t } = useTranslation();

  const securityFeatures = [
    {
      icon: Lock,
      title: t('security.features.https.title', 'HTTPS Encryption'),
      description: t('security.features.https.description', 'All data transmitted between your browser and our servers is encrypted using TLS 1.3, the latest industry standard.'),
    },
    {
      icon: Key,
      title: t('security.features.auth.title', 'Secure Authentication'),
      description: t('security.features.auth.description', 'Firebase Authentication with Google OAuth 2.0 provides secure, industry-standard identity verification.'),
    },
    {
      icon: Database,
      title: t('security.features.database.title', 'Database Security'),
      description: t('security.features.database.description', 'PostgreSQL with encryption at rest, hosted on Neon\'s SOC2-compliant infrastructure with automatic backups.'),
    },
    {
      icon: Eye,
      title: t('security.features.audit.title', 'Audit Logging'),
      description: t('security.features.audit.description', 'Comprehensive logging of all security events, data access, and configuration changes for compliance and forensics.'),
    },
    {
      icon: FileCheck,
      title: t('security.features.hashing.title', 'API Key Hashing'),
      description: t('security.features.hashing.description', 'All API keys are hashed using SHA-256 and verified with timing-safe comparison to prevent timing attacks.'),
    },
    {
      icon: Shield,
      title: t('security.features.secrets.title', 'Secret Management'),
      description: t('security.features.secrets.description', 'Environment variables managed securely via Replit Secrets, never exposed in code or version control.'),
    },
  ];

  const practices = [
    {
      title: t('security.practices.encryption.title', 'Data Encryption'),
      items: [
        t('security.practices.encryption.transit', 'TLS 1.3 for data in transit'),
        t('security.practices.encryption.rest', 'AES-256 encryption at rest'),
        t('security.practices.encryption.api', 'SHA-256 hashing for API keys'),
      ],
    },
    {
      title: t('security.practices.access.title', 'Access Control'),
      items: [
        t('security.practices.access.ownership', 'Ownership verification on all operations'),
        t('security.practices.access.rbac', 'Role-based access control (user/admin)'),
        t('security.practices.access.session', 'Secure session management'),
      ],
    },
    {
      title: t('security.practices.monitoring.title', 'Security Monitoring'),
      items: [
        t('security.practices.monitoring.realtime', 'Real-time threat detection'),
        t('security.practices.monitoring.failed', 'Failed login attempt tracking'),
        t('security.practices.monitoring.audit', 'Security audit log monitoring'),
      ],
    },
    {
      title: t('security.practices.compliance.title', 'Compliance'),
      items: [
        t('security.practices.compliance.soc2', 'SOC2 Type II compliance ready'),
        t('security.practices.compliance.iso', 'ISO 27001 security controls'),
        t('security.practices.compliance.gdpr', 'GDPR-compliant data handling'),
      ],
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
              <Shield className="h-3 w-3 mr-1" />
              {t('security.hero.badge', 'Enterprise-Grade Security')}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t('security.hero.title', 'Security at Our Core')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('security.hero.description', 'We take security seriously. SentinelScope implements industry-leading security practices to protect your data and ensure the integrity of our threat monitoring platform.')}
            </p>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('security.features.title', 'Security Infrastructure')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {securityFeatures.map((feature, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('security.practices.title', 'Security Best Practices')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {practices.map((practice, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">{practice.title}</h3>
                    <ul className="space-y-2">
                      {practice.items.map((item, itemIndex) => (
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

      {/* Incident Response */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('security.incident.title', 'Security Incident Response')}
            </h2>
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {t('security.incident.process.title', 'Our Incident Response Process')}
                    </h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>{t('security.incident.process.detection', 'Detection: Automated monitoring detects anomalies')}</li>
                      <li>{t('security.incident.process.assessment', 'Assessment: Security team evaluates severity and scope')}</li>
                      <li>{t('security.incident.process.containment', 'Containment: Immediate action to isolate the issue')}</li>
                      <li>{t('security.incident.process.investigation', 'Investigation: Root cause analysis and forensics')}</li>
                      <li>{t('security.incident.process.remediation', 'Remediation: Fix vulnerabilities and restore service')}</li>
                      <li>{t('security.incident.process.notification', 'Notification: Inform affected users within 72 hours')}</li>
                      <li>{t('security.incident.process.review', 'Post-incident review: Improve processes and controls')}</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('security.disclosure.title', 'Responsible Disclosure')}
            </h2>
            <Card>
              <CardContent className="p-8">
                <p className="text-muted-foreground mb-6">
                  {t('security.disclosure.intro', 'We appreciate the security research community\'s efforts to help keep SentinelScope secure. If you discover a security vulnerability, please report it responsibly:')}
                </p>
                <div className="bg-muted p-6 rounded-md space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t('security.disclosure.contact.title', 'Contact')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Email: security@sentinelscope.com
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t('security.disclosure.guidelines.title', 'Guidelines')}
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>{t('security.disclosure.guidelines.private', 'Do not publicly disclose the vulnerability before we fix it')}</li>
                      <li>{t('security.disclosure.guidelines.details', 'Provide detailed steps to reproduce the issue')}</li>
                      <li>{t('security.disclosure.guidelines.time', 'Allow reasonable time for us to address the issue')}</li>
                      <li>{t('security.disclosure.guidelines.legal', 'Do not exploit the vulnerability beyond proof-of-concept')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t('security.disclosure.response.title', 'Our Commitment')}
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>{t('security.disclosure.response.acknowledge', 'Acknowledge receipt within 48 hours')}</li>
                      <li>{t('security.disclosure.response.updates', 'Provide regular updates on remediation progress')}</li>
                      <li>{t('security.disclosure.response.credit', 'Credit researchers upon disclosure (if desired)')}</li>
                      <li>{t('security.disclosure.response.legal', 'No legal action against good-faith security research')}</li>
                    </ul>
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

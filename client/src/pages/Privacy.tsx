import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const { t } = useTranslation();

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

      {/* Content */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">
            {t('privacy.title', 'Privacy Policy')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('privacy.updated', 'Last Updated: January 2025')}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <Card>
              <CardContent className="p-8 space-y-6">
                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.intro.title', '1. Introduction')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.intro.content', 'SentinelScope ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our cybersecurity monitoring platform.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.collection.title', '2. Information We Collect')}
                  </h2>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('privacy.collection.personal.title', 'Personal Information')}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                    <li>{t('privacy.collection.personal.email', 'Email address (via Google OAuth)')}</li>
                    <li>{t('privacy.collection.personal.name', 'Name and profile information')}</li>
                    <li>{t('privacy.collection.personal.payment', 'Payment information (processed securely via Stripe)')}</li>
                  </ul>

                  <h3 className="text-lg font-semibold mb-2">
                    {t('privacy.collection.security.title', 'Security Event Data')}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                    <li>{t('privacy.collection.security.threats', 'Threat detection logs and alerts')}</li>
                    <li>{t('privacy.collection.security.events', 'Security events from your configured sources')}</li>
                    <li>{t('privacy.collection.security.ip', 'IP addresses and geolocation data')}</li>
                    <li>{t('privacy.collection.security.hashes', 'File hashes and malware signatures')}</li>
                  </ul>

                  <h3 className="text-lg font-semibold mb-2">
                    {t('privacy.collection.usage.title', 'Usage Data')}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('privacy.collection.usage.browser', 'Browser type and version')}</li>
                    <li>{t('privacy.collection.usage.activity', 'Pages visited and features used')}</li>
                    <li>{t('privacy.collection.usage.time', 'Time and date of access')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.use.title', '3. How We Use Your Information')}
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('privacy.use.service', 'Provide and maintain our security monitoring services')}</li>
                    <li>{t('privacy.use.detection', 'Detect, analyze, and alert you to cybersecurity threats')}</li>
                    <li>{t('privacy.use.improve', 'Improve our threat detection algorithms')}</li>
                    <li>{t('privacy.use.support', 'Provide customer support and technical assistance')}</li>
                    <li>{t('privacy.use.billing', 'Process subscription payments')}</li>
                    <li>{t('privacy.use.compliance', 'Maintain audit logs for SOC2/ISO 27001 compliance')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.sharing.title', '4. Information Sharing')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('privacy.sharing.intro', 'We do not sell your personal information. We may share information with:')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li><strong>VirusTotal:</strong> {t('privacy.sharing.virustotal', 'File hashes, URLs, and IPs for malware analysis')}</li>
                    <li><strong>Stripe:</strong> {t('privacy.sharing.stripe', 'Payment information for subscription processing')}</li>
                    <li><strong>Firebase:</strong> {t('privacy.sharing.firebase', 'Authentication data for identity verification')}</li>
                    <li><strong>{t('privacy.sharing.legal.title', 'Legal Requirements:')}</strong> {t('privacy.sharing.legal.desc', 'If required by law or to protect our rights')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.security.title', '5. Data Security')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('privacy.security.content', 'We implement industry-standard security measures to protect your data:')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('privacy.security.encryption', 'HTTPS encryption for all data in transit')}</li>
                    <li>{t('privacy.security.database', 'PostgreSQL database with encryption at rest')}</li>
                    <li>{t('privacy.security.hashing', 'API key hashing with SHA-256')}</li>
                    <li>{t('privacy.security.auth', 'Secure authentication via Firebase Auth')}</li>
                    <li>{t('privacy.security.audit', 'Comprehensive security audit logging')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.rights.title', '6. Your Rights')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('privacy.rights.intro', 'You have the right to:')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li><strong>{t('privacy.rights.access.title', 'Access:')}</strong> {t('privacy.rights.access.desc', 'Request a copy of your data')}</li>
                    <li><strong>{t('privacy.rights.rectification.title', 'Rectification:')}</strong> {t('privacy.rights.rectification.desc', 'Correct inaccurate information')}</li>
                    <li><strong>{t('privacy.rights.deletion.title', 'Deletion:')}</strong> {t('privacy.rights.deletion.desc', 'Request deletion of your account and data')}</li>
                    <li><strong>{t('privacy.rights.portability.title', 'Data Portability:')}</strong> {t('privacy.rights.portability.desc', 'Export your data in a machine-readable format')}</li>
                    <li><strong>{t('privacy.rights.objection.title', 'Objection:')}</strong> {t('privacy.rights.objection.desc', 'Object to processing of your data')}</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    {t('privacy.rights.exercise', 'To exercise these rights, contact us at contact@sentinel-scope.com')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.retention.title', '7. Data Retention')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.retention.content', 'We retain your data for as long as your account is active or as needed to provide services. Security event data is retained according to your subscription tier and compliance requirements. Deleted databases have a 7-day recovery window.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.cookies.title', '8. Cookies and Tracking')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.cookies.content', 'We use essential cookies for authentication and session management. We do not use third-party advertising or analytics cookies.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.children.title', '9. Children\'s Privacy')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.children.content', 'Our service is not directed to individuals under 18. We do not knowingly collect information from children.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.changes.title', '10. Changes to This Policy')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.changes.content', 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or through the platform.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('privacy.contact.title', '11. Contact Us')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('privacy.contact.content', 'If you have questions about this Privacy Policy, please contact us at:')}
                  </p>
                  <div className="mt-4 p-4 bg-muted rounded-md">
                    <p className="font-semibold">SentinelScope Privacy Team</p>
                    <p className="text-muted-foreground">Email: contact@sentinel-scope.com</p>
                    <p className="text-muted-foreground">Support: contact@sentinel-scope.com</p>
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

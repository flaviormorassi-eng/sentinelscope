import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button'; // Ensure Button is imported
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Terms() {
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
            {t('terms.title', 'Terms of Service')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('terms.updated', 'Last Updated: January 2025')}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <Card>
              <CardContent className="p-8 space-y-6">
                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.acceptance.title', '1. Acceptance of Terms')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('terms.acceptance.content', 'By accessing or using SentinelScope, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.description.title', '2. Service Description')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('terms.description.intro', 'SentinelScope provides real-time cybersecurity monitoring services including:')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.description.monitoring', 'Real-time threat detection and monitoring')}</li>
                    <li>{t('terms.description.alerts', 'Alert notifications for security events')}</li>
                    <li>{t('terms.description.virustotal', 'VirusTotal malware scanning integration')}</li>
                    <li>{t('terms.description.reports', 'Security reports and analytics')}</li>
                    <li>{t('terms.description.sources', 'Event source management (syslog, API, agents, webhooks)')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.account.title', '3. Account Registration')}
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.account.accurate', 'You must provide accurate and complete information')}</li>
                    <li>{t('terms.account.security', 'You are responsible for maintaining account security')}</li>
                    <li>{t('terms.account.confidential', 'You must keep your credentials confidential')}</li>
                    <li>{t('terms.account.notify', 'Notify us immediately of any unauthorized access')}</li>
                    <li>{t('terms.account.age', 'You must be at least 18 years old to use our service')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.subscription.title', '4. Subscription and Billing')}
                  </h2>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('terms.subscription.tiers.title', 'Subscription Tiers')}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                    <li><strong>Individual ($5/month):</strong> {t('terms.subscription.individual', '24-hour real monitoring trial, then demo mode only')}</li>
                    <li><strong>SMB ($49.99/month):</strong> {t('terms.subscription.smb', 'Unlimited real monitoring, up to 10 devices')}</li>
                    <li><strong>Enterprise ($199.99/month):</strong> {t('terms.subscription.enterprise', 'Unlimited devices and priority support')}</li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold mb-2">
                    {t('terms.subscription.billing.title', 'Billing Terms')}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.subscription.billing.auto', 'Subscriptions automatically renew monthly')}</li>
                    <li>{t('terms.subscription.billing.payment', 'Payment is processed securely via Stripe')}</li>
                    <li>{t('terms.subscription.billing.refund', 'No refunds for partial months')}</li>
                    <li>{t('terms.subscription.billing.cancel', 'Cancellations take effect at the end of the current billing period')}</li>
                    <li>{t('terms.subscription.billing.failed', 'Failed payments may result in service suspension')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.usage.title', '5. Acceptable Use')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('terms.usage.intro', 'You agree not to:')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.usage.illegal', 'Use the service for illegal activities')}</li>
                    <li>{t('terms.usage.interfere', 'Interfere with or disrupt the service')}</li>
                    <li>{t('terms.usage.reverse', 'Reverse engineer or attempt to extract source code')}</li>
                    <li>{t('terms.usage.resell', 'Resell or redistribute the service without permission')}</li>
                    <li>{t('terms.usage.abuse', 'Abuse API rate limits or attempt to overload the system')}</li>
                    <li>{t('terms.usage.false', 'Submit false or misleading threat data')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.data.title', '6. Data and Privacy')}
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.data.privacy', 'Your data is governed by our Privacy Policy')}</li>
                    <li>{t('terms.data.ownership', 'You retain ownership of your security event data')}</li>
                    <li>{t('terms.data.process', 'We process data to provide threat detection services')}</li>
                    <li>{t('terms.data.backup', 'We maintain backups with 7-day retention for deleted data')}</li>
                    <li>{t('terms.data.export', 'You can export your data at any time')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.warranty.title', '7. Service Availability and Warranty')}
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.warranty.uptime', 'We target 99.9% uptime but do not guarantee uninterrupted service')}</li>
                    <li>{t('terms.warranty.maintenance', 'Scheduled maintenance will be communicated in advance')}</li>
                    <li>{t('terms.warranty.asis', 'The service is provided "as is" without warranties')}</li>
                    <li>{t('terms.warranty.accuracy', 'We do not guarantee 100% threat detection accuracy')}</li>
                    <li>{t('terms.warranty.external', 'We are not responsible for third-party service failures (VirusTotal, Stripe, Firebase)')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.liability.title', '8. Limitation of Liability')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('terms.liability.content', 'To the maximum extent permitted by law, SentinelScope shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to data loss, security breaches, or business interruption. Our total liability is limited to the amount you paid in the last 12 months.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.termination.title', '9. Termination')}
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>{t('terms.termination.user', 'You may cancel your subscription at any time')}</li>
                    <li>{t('terms.termination.us', 'We may suspend or terminate accounts for Terms violations')}</li>
                    <li>{t('terms.termination.payment', 'Non-payment may result in service suspension')}</li>
                    <li>{t('terms.termination.data', 'Upon termination, your data is retained for 7 days then permanently deleted')}</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.ip.title', '10. Intellectual Property')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('terms.ip.content', 'All intellectual property rights in SentinelScope, including software, design, and content, belong to us or our licensors. You receive a limited, non-exclusive, non-transferable license to use the service according to these Terms.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.changes.title', '11. Changes to Terms')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('terms.changes.content', 'We reserve the right to modify these Terms at any time. Significant changes will be communicated via email. Continued use after changes constitutes acceptance of the new Terms.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.governing.title', '12. Governing Law')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('terms.governing.content', 'These Terms are governed by the laws of the jurisdiction in which SentinelScope operates, without regard to conflict of law provisions.')}
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">
                    {t('terms.contact.title', '13. Contact Information')}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t('terms.contact.content', 'For questions about these Terms, contact us at:')}
                  </p>
                  <div className="p-4 bg-muted rounded-md">
                    <p className="font-semibold">SentinelScope Legal Team</p>
                    <p className="text-muted-foreground">Email: legal@sentinelscope.com</p>
                    <p className="text-muted-foreground">Support: support@sentinelscope.com</p>
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

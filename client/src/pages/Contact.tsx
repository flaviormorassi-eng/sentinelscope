import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, Mail, MessageSquare, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: t('contact.form.success', 'Message Sent!'),
      description: t('contact.form.successDesc', 'We\'ll get back to you within 24 hours.'),
    });
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const contactMethods = [
    {
      icon: Mail,
      title: t('contact.methods.email.title', 'Email Support'),
      description: 'support@sentinelscope.com',
      action: t('contact.methods.email.action', 'Send Email'),
    },
    {
      icon: MessageSquare,
      title: t('contact.methods.chat.title', 'Live Chat'),
      description: t('contact.methods.chat.description', 'Available 24/7 for urgent issues'),
      action: t('contact.methods.chat.action', 'Start Chat'),
    },
    {
      icon: Phone,
      title: t('contact.methods.phone.title', 'Phone Support'),
      description: t('contact.methods.phone.description', 'Enterprise customers only'),
      action: t('contact.methods.phone.action', 'Call Us'),
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
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t('contact.hero.title', 'Get in Touch')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('contact.hero.description', 'Have questions about SentinelScope? Our team is here to help you secure your digital assets.')}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-3xl font-bold mb-8">
              {t('contact.form.title', 'Send Us a Message')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  {t('contact.form.name', 'Name')}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border bg-background"
                  data-testid="input-contact-name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  {t('contact.form.email', 'Email')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border bg-background"
                  data-testid="input-contact-email"
                />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2">
                  {t('contact.form.subject', 'Subject')}
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border bg-background"
                  data-testid="input-contact-subject"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  {t('contact.form.message', 'Message')}
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border bg-background resize-none"
                  data-testid="input-contact-message"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" data-testid="button-send-message">
                {t('contact.form.submit', 'Send Message')}
              </Button>
            </form>
          </div>

          {/* Contact Methods */}
          <div>
            <h2 className="text-3xl font-bold mb-8">
              {t('contact.methods.title', 'Other Ways to Reach Us')}
            </h2>
            <div className="space-y-6">
              {contactMethods.map((method, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <method.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{method.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" data-testid={`button-contact-${index}`}>
                      {method.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Office Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">
                        {t('contact.office.title', 'Headquarters')}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t('contact.office.address', 'Remote-first company')}
                        <br />
                        {t('contact.office.global', 'Team distributed globally')}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

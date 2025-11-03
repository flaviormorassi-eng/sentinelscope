import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, MapPin, Clock, DollarSign, Briefcase } from 'lucide-react';

export default function Careers() {
  const { t } = useTranslation();

  const benefits = [
    t('careers.benefits.health', 'Comprehensive health, dental, and vision insurance'),
    t('careers.benefits.remote', 'Remote-first work environment'),
    t('careers.benefits.pto', 'Unlimited PTO and flexible working hours'),
    t('careers.benefits.equity', 'Competitive salary and equity packages'),
    t('careers.benefits.learning', 'Professional development budget'),
    t('careers.benefits.equipment', 'Latest tech equipment and tools'),
  ];

  const openings = [
    {
      title: 'Senior Security Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.security.description', 'Build and maintain threat detection algorithms and security infrastructure.'),
    },
    {
      title: 'Full-Stack Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.fullstack.description', 'Develop scalable web applications with React, TypeScript, and Node.js.'),
    },
    {
      title: 'Security Analyst',
      department: 'Security Operations',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.analyst.description', 'Monitor threats, investigate incidents, and provide customer support.'),
    },
    {
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.designer.description', 'Design intuitive interfaces for complex security monitoring tools.'),
    },
    {
      title: 'DevOps Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.devops.description', 'Manage infrastructure, CI/CD pipelines, and deployment automation.'),
    },
    {
      title: 'Customer Success Manager',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      description: t('careers.jobs.csm.description', 'Help customers maximize value from SentinelScope and achieve their security goals.'),
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
              {t('careers.hero.title', 'Join Our Mission to Secure the Digital World')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('careers.hero.description', 'We\'re building the future of cybersecurity monitoring. Join a team of passionate engineers, designers, and security experts making the internet safer for everyone.')}
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('careers.benefits.title', 'Why Work With Us?')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <Card key={index}>
                  <CardContent className="p-6 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground">{benefit}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('careers.openings.title', 'Open Positions')}
            </h2>
            <div className="space-y-4">
              {openings.map((job, index) => (
                <Card key={index} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{job.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge variant="secondary">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {job.department}
                          </Badge>
                          <Badge variant="secondary">
                            <MapPin className="h-3 w-3 mr-1" />
                            {job.location}
                          </Badge>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {job.type}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{job.description}</p>
                      </div>
                      <Button data-testid={`button-apply-${index}`}>
                        {t('careers.apply', 'Apply Now')}
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {t('careers.cta.title', 'Don\'t See a Perfect Fit?')}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t('careers.cta.description', 'We\'re always looking for talented individuals. Send us your resume and tell us how you can contribute.')}
            </p>
            <Link href="/contact">
              <Button size="lg" data-testid="button-general-inquiry">
                {t('careers.cta.button', 'Get in Touch')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

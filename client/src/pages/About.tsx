import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button'; // Ensure Button is imported
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users, Target, Award, ArrowLeft } from 'lucide-react';

export default function About() {
  const { t } = useTranslation();

  const values = [
    {
      icon: Shield,
      title: t('about.values.security.title', 'Security First'),
      description: t('about.values.security.description', 'We prioritize the security and privacy of your data above all else, implementing industry-leading encryption and security practices.'),
    },
    {
      icon: Users,
      title: t('about.values.customer.title', 'Customer-Centric'),
      description: t('about.values.customer.description', 'Our customers are at the heart of everything we do. We build solutions that solve real-world cybersecurity challenges.'),
    },
    {
      icon: Target,
      title: t('about.values.innovation.title', 'Innovation'),
      description: t('about.values.innovation.description', 'We continuously innovate to stay ahead of emerging threats and provide cutting-edge threat intelligence.'),
    },
    {
      icon: Award,
      title: t('about.values.excellence.title', 'Excellence'),
      description: t('about.values.excellence.description', 'We strive for excellence in every aspect of our platform, from threat detection to customer support.'),
    },
  ];

  const team = [
    {
      name: 'Security Team',
      role: t('about.team.security', 'Threat Intelligence Experts'),
      description: t('about.team.securityDesc', 'Former security researchers from leading cybersecurity firms with decades of combined experience.'),
    },
    {
      name: 'Engineering Team',
      role: t('about.team.engineering', 'Full-Stack Engineers'),
      description: t('about.team.engineeringDesc', 'Building scalable, real-time monitoring systems that process millions of events per day.'),
    },
    {
      name: 'Support Team',
      role: t('about.team.support', '24/7 Customer Support'),
      description: t('about.team.supportDesc', 'Dedicated support professionals ready to help you protect your digital assets around the clock.'),
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
              {t('about.hero.title', 'Protecting Digital Assets Since 2024')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('about.hero.description', 'SentinelScope is a next-generation cybersecurity monitoring platform designed to detect, analyze, and neutralize threats in real-time. Our mission is to make enterprise-grade security accessible to organizations of all sizes.')}
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('about.mission.title', 'Our Mission')}
            </h2>
            <Card>
              <CardContent className="p-8">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t('about.mission.content', 'We believe that every organization deserves access to world-class cybersecurity tools. SentinelScope democratizes enterprise-grade threat intelligence by providing real-time monitoring, advanced analytics, and actionable insights at an affordable price. Our platform combines cutting-edge technology with intuitive design, empowering security teams to stay ahead of evolving cyber threats.')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('about.values.title', 'Our Values')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <value.icon className="h-10 w-10 text-primary mb-4" />
                    <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">
              {t('about.team.title', 'Our Team')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {team.map((member, index) => (
                <Card key={index}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                    <p className="text-sm text-primary mb-3">{member.role}</p>
                    <p className="text-muted-foreground text-sm">{member.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {t('about.cta.title', 'Ready to Secure Your Digital Assets?')}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t('about.cta.description', 'Join thousands of organizations protecting their infrastructure with SentinelScope.')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" data-testid="button-get-started">
                  {t('common.getStarted', 'Get Started')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" data-testid="button-contact-sales">
                  {t('about.cta.contactSales', 'Contact Sales')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Activity, 
  Globe, 
  Bell, 
  BarChart, 
  Lock,
  Zap,
  Users,
  CheckCircle,
  ArrowRight,
  Search,
  FileText,
  Smartphone,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useAuth } from '@/contexts/AuthContext';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '@shared/schema';

export default function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Activity,
      title: 'Real-Time Threat Monitoring',
      description: 'Monitor threats as they happen with live detection and instant alerts across your entire network.',
    },
    {
      icon: Globe,
      title: 'Geographic Threat Mapping',
      description: 'Visualize attack origins on an interactive world map with detailed geolocation data.',
    },
    {
      icon: Search,
      title: 'VirusTotal Integration',
      description: 'Scan file hashes, URLs, and IPs against the world\'s largest malware database in real-time.',
    },
    {
      icon: Bell,
      title: 'Intelligent Alerting',
      description: 'Get notified instantly about critical threats with customizable alert rules and severity levels.',
    },
    {
      icon: Lock,
      title: 'Admin Threat Blocking',
      description: 'Review and block threats with admin approval workflow and complete audit trail for compliance.',
    },
    {
      icon: FileText,
      title: 'Security Reports',
      description: 'Generate comprehensive PDF, CSV, and JSON reports for compliance and analysis.',
    },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime Guarantee' },
    { value: '<100ms', label: 'Detection Speed' },
    { value: '24/7', label: 'Monitoring' },
    { value: '50+', label: 'Threat Types' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">SentinelScope</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-features">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-how-it-works">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-pricing">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard">
                <Button data-testid="button-dashboard">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button data-testid="button-get-started">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4" variant="outline">
              <Zap className="h-3 w-3 mr-1" />
              Enterprise-Grade Security Platform
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Protect Your Digital Assets with{' '}
              <span className="text-primary">Real-Time Intelligence</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Advanced cybersecurity monitoring platform that detects, analyzes, and blocks threats before they impact your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2" data-testid="button-hero-dashboard">
                    Go to Dashboard
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="lg" className="gap-2" data-testid="button-hero-start">
                      Start Free Trial
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="gap-2" data-testid="button-view-demo">
                    View Demo
                  </Button>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-16 border-t">
              {stats.map((stat, index) => (
                <div key={index} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2" data-testid={`stat-value-${index}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`stat-label-${index}`}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comprehensive Threat Protection
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to monitor, detect, and respond to cyber threats in real-time
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-feature-${index}`}>
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
            <div className="flex-1 space-y-6">
              <Badge variant="outline" className="mb-2">
                <Smartphone className="h-3 w-3 mr-1" />
                New: Mobile Command Center
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                SentinelScope in Your Pocket
              </h2>
              <p className="text-lg text-muted-foreground">
                Stay connected to your security infrastructure anywhere, anytime. Our new mobile experience acts as a portable command center, not just a viewer.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6 mt-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Real-Time Feeds</h3>
                    <p className="text-sm text-muted-foreground">Access live threat streams and monitoring stats exactly as they happen.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Instant Alerts</h3>
                    <p className="text-sm text-muted-foreground">Acknowledge and resolve critical alerts immediately from your phone.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">VirusTotal Scanner</h3>
                    <p className="text-sm text-muted-foreground">Quickly scan suspicious IPs or URLs found in emails or logs on the go.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <WifiOff className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Offline Access</h3>
                    <p className="text-sm text-muted-foreground">View cached reports and dashboards even with spotty connections.</p>
                  </div>
                </div>
              </div>

               <div className="flex flex-col sm:flex-row gap-3 pt-4">
                 <Button variant="outline" className="gap-2" disabled>
                   <span className="opacity-70">Download for iOS</span>
                 </Button>
                 <Button variant="outline" className="gap-2" disabled>
                    <span className="opacity-70">Download for Android</span>
                 </Button>
                 <span className="text-xs text-muted-foreground self-center sm:ml-2">Coming soon to stores</span>
               </div>
            </div>
            
            {/* Phone Mockup Representation */}
            <div className="flex-1 flex justify-center lg:justify-end">
              <div className="relative border-gray-800 bg-gray-950 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl flex flex-col overflow-hidden">
                <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                <div className="rounded-[2rem] overflow-hidden w-full h-full bg-background flex flex-col relative">
                   {/* Simplified Header */}
                   <div className="h-12 border-b flex items-center px-4 justify-between bg-card/50 backdrop-blur-sm z-10">
                      <div className="h-4 w-4 rounded-full bg-primary/20"></div>
                      <div className="h-2 w-20 rounded-full bg-muted"></div>
                      <div className="h-4 w-4 rounded-full bg-muted"></div>
                   </div>
                   {/* Mock Content */}
                   <div className="flex-1 p-4 space-y-4 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
                      
                      <div className="flex gap-2">
                        <div className="h-24 flex-1 rounded-xl bg-primary/5 border border-primary/20 p-3 flex flex-col justify-between">
                           <div className="h-6 w-6 rounded-full bg-primary/20"></div>
                           <div className="space-y-1">
                             <div className="h-4 w-12 rounded bg-primary/20"></div>
                             <div className="h-2 w-16 rounded bg-muted/50"></div>
                           </div>
                        </div>
                        <div className="h-24 flex-1 rounded-xl bg-card border p-3 flex flex-col justify-between">
                           <div className="h-6 w-6 rounded-full bg-muted"></div>
                           <div className="space-y-1">
                             <div className="h-4 w-12 rounded bg-muted"></div>
                             <div className="h-2 w-16 rounded bg-muted/50"></div>
                           </div>
                        </div>
                      </div>

                      <div className="h-40 rounded-xl bg-card border p-4 space-y-3">
                         <div className="flex justify-between items-center">
                            <div className="h-3 w-24 rounded bg-muted"></div>
                            <div className="h-3 w-8 rounded bg-muted"></div>
                         </div>
                         <div className="flex items-end gap-1 h-24 pb-2 justify-between px-2">
                            <div className="w-4 bg-primary/20 h-[40%] rounded-t-sm"></div>
                            <div className="w-4 bg-primary/30 h-[70%] rounded-t-sm"></div>
                            <div className="w-4 bg-primary/20 h-[30%] rounded-t-sm"></div>
                            <div className="w-4 bg-primary/60 h-[85%] rounded-t-sm"></div>
                            <div className="w-4 bg-primary/40 h-[50%] rounded-t-sm"></div>
                            <div className="w-4 bg-primary h-[90%] rounded-t-sm text-[8px] flex items-center justify-center text-primary-foreground">Live</div>
                            <div className="w-4 bg-primary/30 h-[60%] rounded-t-sm"></div>
                         </div>
                      </div>

                      <div className="space-y-2">
                         <div className="h-3 w-32 rounded bg-muted mb-2"></div>
                         {[1,2,3].map(i => (
                           <div key={i} className="h-12 rounded-lg bg-card border flex items-center px-3 gap-3">
                              <div className="h-8 w-8 rounded bg-red-500/10 flex items-center justify-center">
                                 <div className="h-4 w-4 rounded-full bg-red-500/40"></div>
                              </div>
                              <div className="space-y-1 flex-1">
                                 <div className="h-2 w-24 rounded bg-muted"></div>
                                 <div className="h-2 w-16 rounded bg-muted/50"></div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How SentinelScope Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Simple, powerful, and effective threat management in three steps
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Detect',
                  description: 'Our AI-powered system continuously monitors your network, analyzing traffic patterns and identifying suspicious activity in real-time.',
                  icon: Activity,
                },
                {
                  step: '02',
                  title: 'Analyze',
                  description: 'Threats are automatically classified by type, severity, and origin. Admin reviews pending threats with complete context and intelligence.',
                  icon: BarChart,
                },
                {
                  step: '03',
                  title: 'Protect',
                  description: 'Take action with one click - block threats, generate reports, and maintain complete audit trails for compliance.',
                  icon: Shield,
                },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-muted-foreground/20 mb-2">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-muted-foreground">
              Flexible pricing for individuals, teams, and enterprises
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(Object.entries(SUBSCRIPTION_TIERS) as [SubscriptionTier, typeof SUBSCRIPTION_TIERS[SubscriptionTier]][]).map(
              ([tierId, tier]) => {
                const isPopular = tierId === 'smb';
                
                return (
                  <Card key={tierId} className={`relative ${isPopular ? 'border-primary border-2' : ''}`}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary">Most Popular</Badge>
                      </div>
                    )}
                    <CardContent className="p-6">
                      <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                      <p className="text-muted-foreground mb-4">
                        {tierId === 'individual' && 'Perfect for personal use'}
                        {tierId === 'smb' && 'For growing teams'}
                        {tierId === 'enterprise' && 'For large organizations'}
                      </p>
                      <div className="mb-6">
                        <span className="text-4xl font-bold">${tier.price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <ul className="space-y-3 mb-6">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {user ? (
                        <Button 
                          className="w-full" 
                          variant={isPopular ? 'default' : 'outline'}
                          onClick={() => setLocation(`/checkout?tier=${tierId}`)}
                          data-testid={`button-plan-${tierId}`}
                        >
                          Choose Plan
                        </Button>
                      ) : (
                        <Link href="/login">
                          <Button 
                            className="w-full" 
                            variant={isPopular ? 'default' : 'outline'}
                            data-testid={`button-plan-${tierId}`}
                          >
                            Get Started
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-primary text-primary-foreground">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Secure Your Digital Assets?
              </h2>
              <p className="text-lg mb-8 opacity-90">
                Join thousands of organizations protecting their infrastructure with SentinelScope
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" variant="secondary" className="gap-2" data-testid="button-cta-start">
                    Start Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="gap-2 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-cta-contact">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-bold">SentinelScope</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enterprise-grade cybersecurity monitoring platform for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground" data-testid="link-footer-features">{t('nav.features')}</a></li>
                <li><a href="#pricing" className="hover:text-foreground" data-testid="link-footer-pricing">{t('nav.pricing')}</a></li>
                <li><Link href="/security" className="hover:text-foreground" data-testid="link-footer-security">{t('nav.security')}</Link></li>
                <li><Link href="/install-guide" className="hover:text-foreground" data-testid="link-footer-integrations">{t('nav.installGuide')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground" data-testid="link-footer-about">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground" data-testid="link-footer-blog">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-foreground" data-testid="link-footer-careers">{t('nav.careers')}</Link></li>
                <li><Link href="/contact" className="hover:text-foreground" data-testid="link-footer-contact">{t('nav.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground" data-testid="link-footer-privacy">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground" data-testid="link-footer-terms">Terms</Link></li>
                <li><Link href="/security" className="hover:text-foreground" data-testid="link-footer-security-legal">Security</Link></li>
                <li><Link href="/compliance" className="hover:text-foreground" data-testid="link-footer-compliance">{t('nav.compliance')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 SentinelScope. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

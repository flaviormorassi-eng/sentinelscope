import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, Calendar, User, ArrowRight } from 'lucide-react';

export default function Blog() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await apiRequest("POST", "/api/newsletter", { email });
      toast({
        title: "Subscribed!",
        description: "Thank you for subscribing to our newsletter.",
      });
      setEmail("");
    } catch (error: any) {
       toast({
        title: "Error",
        description: error.message || "Failed to subscribe.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const posts = [
    {
      title: t('blog.post1.title', '10 Essential Cybersecurity Best Practices for 2025'),
      excerpt: t('blog.post1.excerpt', 'Learn the critical security measures every organization should implement to protect against modern cyber threats.'),
      category: 'Security Tips',
      date: '2025-01-15',
      author: 'Security Team',
      readTime: '5 min',
    },
    {
      title: t('blog.post2.title', 'Understanding Real-Time Threat Detection'),
      excerpt: t('blog.post2.excerpt', 'How real-time monitoring can help you detect and respond to threats before they cause damage to your infrastructure.'),
      category: 'Technology',
      date: '2025-01-10',
      author: 'Engineering Team',
      readTime: '7 min',
    },
    {
      title: t('blog.post3.title', 'SOC2 Compliance Made Simple'),
      excerpt: t('blog.post3.excerpt', 'A comprehensive guide to achieving SOC2 compliance with SentinelScope\'s built-in audit logging and reporting.'),
      category: 'Compliance',
      date: '2025-01-05',
      author: 'Compliance Team',
      readTime: '10 min',
    },
    {
      title: t('blog.post4.title', 'Case Study: Blocking 10,000 Threats in One Week'),
      excerpt: t('blog.post4.excerpt', 'How a mid-sized enterprise used SentinelScope to identify and neutralize a coordinated attack campaign.'),
      category: 'Case Study',
      date: '2024-12-28',
      author: 'Customer Success',
      readTime: '6 min',
    },
    {
      title: t('blog.post5.title', 'VirusTotal Integration: Leveraging Global Threat Intelligence'),
      excerpt: t('blog.post5.excerpt', 'Discover how SentinelScope\'s VirusTotal integration provides instant malware analysis for files, URLs, and IPs.'),
      category: 'Features',
      date: '2024-12-20',
      author: 'Product Team',
      readTime: '4 min',
    },
    {
      title: t('blog.post6.title', 'Event Source Management: Unified Security Monitoring'),
      excerpt: t('blog.post6.excerpt', 'Learn how to consolidate logs from syslog, REST APIs, agents, and webhooks into a single monitoring dashboard.'),
      category: 'Tutorial',
      date: '2024-12-15',
      author: 'Engineering Team',
      readTime: '8 min',
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
              {t('blog.hero.title', 'SentinelScope Blog')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('blog.hero.description', 'Insights, tutorials, and best practices for cybersecurity professionals.')}
            </p>
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => (
                <Card key={index} className="flex flex-col hover-elevate">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <Badge variant="secondary">{post.category}</Badge>
                      <span className="text-xs text-muted-foreground">{post.readTime}</span>
                    </div>
                    <CardTitle className="text-xl leading-tight">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-muted-foreground mb-6 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(post.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="mt-4 w-full justify-between" 
                      data-testid={`button-read-post-${index}`}
                    >
                      {t('blog.readMore', 'Read More')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {t('blog.newsletter.title', 'Stay Updated')}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t('blog.newsletter.description', 'Subscribe to our newsletter for the latest cybersecurity insights and product updates.')}
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder={t('blog.newsletter.placeholder', 'Enter your email')}
                className="flex-1 px-4 py-2 rounded-md border bg-background"
                data-testid="input-newsletter-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Button 
                data-testid="button-subscribe" 
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? "..." : t('blog.newsletter.subscribe', 'Subscribe')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

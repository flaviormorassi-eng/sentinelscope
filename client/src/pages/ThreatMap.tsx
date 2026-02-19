import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Threat, ThreatEvent, UserPreferences } from '@shared/schema';
import { format } from 'date-fns';
import { useLocation, useSearch } from 'wouter';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Create custom threat markers with severity colors
const createThreatIcon = (severity: string) => {
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${colors[severity as keyof typeof colors] || colors.medium};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      animation: pulse 2s infinite;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

type MapThreat = (Threat | ThreatEvent) & { threatType?: string };
type MapThreatWithLocation = MapThreat & {
  sourceLat: string;
  sourceLon: string;
  sourceIP?: string;
  sourceCity?: string;
  sourceCountry?: string;
  description?: string;
  targetIP?: string;
  type?: string;
  timestamp?: any;
};

function hasLocation(t: MapThreat): t is MapThreatWithLocation {
  const latRaw = (t as any).sourceLat;
  const lonRaw = (t as any).sourceLon;
  if (latRaw === null || latRaw === undefined || lonRaw === null || lonRaw === undefined) return false;
  const lat = Number.parseFloat(String(latRaw));
  const lon = Number.parseFloat(String(lonRaw));
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function MapUpdater({ threats }: { threats: MapThreat[] }) {
  const map = useMap();

  useEffect(() => {
    if (threats.length > 0) {
      const bounds = threats
        .filter(hasLocation)
        .map(t => [parseFloat(t.sourceLat), parseFloat(t.sourceLon)] as [number, number]);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      }
    }
  }, [threats, map]);

  return null;
}

export default function ThreatMap() {
  const { t } = useTranslation();
  const tx = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const firstFilteredMarkerRef = useRef<L.Marker | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const sourceIpFilter = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('sourceIp') || '').trim();
  }, [searchString]);

  const focusedThreatId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('threatId') || '').trim();
  }, [searchString]);

  const focusedAlertId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('alertId') || '').trim();
  }, [searchString]);

  const fromAlerts = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('from') === 'alerts';
  }, [searchString]);

  const fromFlow = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('from') === 'flow';
  }, [searchString]);

  const fromThreats = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('from') === 'threats';
  }, [searchString]);

  const returnAlertsHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', 'alerts');
    params.set('from', 'map');
    if (focusedAlertId) params.set('alertId', focusedAlertId);
    if (focusedThreatId) params.set('threatId', focusedThreatId);
    if (sourceIpFilter) params.set('src', sourceIpFilter);
    return `/security-center?${params.toString()}`;
  }, [focusedAlertId, focusedThreatId, sourceIpFilter]);

  const returnFlowHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('view', 'flow');
    params.set('from', 'map');
    if (sourceIpFilter) {
      params.set('sourceIp', sourceIpFilter);
      params.set('focusSourceIp', sourceIpFilter);
    }
    if (focusedThreatId) params.set('threatId', focusedThreatId);
    if (focusedAlertId) params.set('alertId', focusedAlertId);
    return `/network-activity?${params.toString()}`;
  }, [focusedAlertId, focusedThreatId, sourceIpFilter]);

  const returnThreatsHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', 'threats');
    params.set('from', 'map');
    if (sourceIpFilter) params.set('src', sourceIpFilter);
    if (focusedThreatId) params.set('threatId', focusedThreatId);
    if (focusedAlertId) params.set('alertId', focusedAlertId);
    return `/security-center?${params.toString()}`;
  }, [focusedAlertId, focusedThreatId, sourceIpFilter]);

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  // Server decides data based on monitoring mode; single endpoint keeps client simple
  const mapQueryKey = sourceIpFilter
    ? `/api/threats/map?sourceIp=${encodeURIComponent(sourceIpFilter)}`
    : '/api/threats/map';

  const { data: threats = [], isLoading } = useQuery<MapThreat[]>({
    queryKey: [mapQueryKey],
    enabled: !!preferences,
    refetchInterval: 15000,
  });

  const threatsWithLocation = (threats as MapThreat[])
    .filter((t: any) => t.sourceLat && t.sourceLon)
    .map(t => t as MapThreatWithLocation);

  const visibleThreatsWithLocation = useMemo(() => {
    if (!sourceIpFilter) return threatsWithLocation;
    const wanted = sourceIpFilter.toLowerCase();
    return threatsWithLocation.filter((t) => (t.sourceIP || '').toLowerCase() === wanted);
  }, [threatsWithLocation, sourceIpFilter]);

  useEffect(() => {
    if (focusedThreatId) {
      const timer = setTimeout(() => {
        try {
          markerRefs.current[focusedThreatId]?.openPopup();
        } catch {
          // noop
        }
      }, 120);
      return () => clearTimeout(timer);
    }

    if (!sourceIpFilter) return;
    if (!visibleThreatsWithLocation.length) return;

    const timer = setTimeout(() => {
      try {
        firstFilteredMarkerRef.current?.openPopup();
      } catch {
        // noop
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [focusedThreatId, sourceIpFilter, visibleThreatsWithLocation]);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-6 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">{t('map.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {focusedThreatId && (
            <Badge variant="outline" className="font-mono text-xs max-w-full truncate">
              {tx('map.focusedThreat', 'Focused threat')}: {focusedThreatId}
            </Badge>
          )}
          {focusedAlertId && (
            <Badge variant="outline" className="font-mono text-xs max-w-full truncate">
              {tx('map.focusedAlert', 'Focused alert')}: {focusedAlertId}
            </Badge>
          )}
          {fromAlerts && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setLocation(returnAlertsHref)}>
              {tx('map.returnToAlerts', 'Return to Alerts')}
            </Button>
          )}
          {fromFlow && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setLocation(returnFlowHref)}>
              {tx('map.returnToFlow', 'Return to Flow')}
            </Button>
          )}
          {fromThreats && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setLocation(returnThreatsHref)}>
              {tx('map.returnToThreatLog', 'Return to Threat Log')}
            </Button>
          )}
        </div>
      </div>

      {(fromAlerts || fromFlow || fromThreats) && (
        <Alert className="border-sky-500/40 bg-sky-500/10">
          <AlertTitle>{tx('map.contextTitle', 'Focused map context')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-auto px-1 underline" onClick={() => setLocation(returnFlowHref)}>
              {tx('map.openFlow', 'Open Flow')}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-auto px-1 underline" onClick={() => setLocation(returnThreatsHref)}>
              {tx('map.openThreatLog', 'Open Threat Log')}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-auto px-1 underline" onClick={() => setLocation(returnAlertsHref)}>
              {tx('map.openAlerts', 'Open Alerts')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              {t('map.attackOrigins')}
            </CardTitle>
            <Badge variant="destructive" className="text-xs sm:text-sm">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white animate-pulse mr-1.5" />
              {t('map.liveIndicator')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="sm:rounded-lg overflow-hidden border-y sm:border" style={{ height: '65vh', maxHeight: '600px', minHeight: '400px' }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : visibleThreatsWithLocation.length > 0 ? (
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater threats={visibleThreatsWithLocation} />
                {visibleThreatsWithLocation.map((threat, index) => (
                  <Marker
                    key={threat.id}
                    position={[parseFloat(threat.sourceLat!), parseFloat(threat.sourceLon!)]}
                    icon={createThreatIcon(threat.severity)}
                    ref={(m) => {
                      markerRefs.current[String(threat.id)] = m;
                      if (index === 0 && sourceIpFilter) firstFilteredMarkerRef.current = m;
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[200px] sm:min-w-[250px]">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                            {t(`threats.severityLevels.${threat.severity}`)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(() => {
                              const rawTs = (threat as any).timestamp ?? (threat as any).createdAt;
                              if (!rawTs) return '-';
                              const d = new Date(rawTs);
                              return Number.isNaN(d.getTime()) ? '-' : format(d, 'HH:mm:ss');
                            })()}
                          </span>
                        </div>
                        <p className="font-medium mb-1 text-sm sm:text-base">{(threat as any).description}</p>
                        <p className="text-xs text-muted-foreground mb-1">
                          {(threat as any).threatType || (threat as any).type || t('threats.unknown')}
                        </p>
                        <div className="text-xs font-mono space-y-1 mt-2 pt-2 border-t">
                          <p><strong>Source:</strong> {threat.sourceIP}</p>
                          <p><strong>Location:</strong> {threat.sourceCity}, {threat.sourceCountry}</p>
                          <p><strong>Target:</strong> {(threat as any).targetIP}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setLocation(`/network-activity?from=map&view=flow&sourceIp=${encodeURIComponent(String(threat.sourceIP || ''))}&focusSourceIp=${encodeURIComponent(String(threat.sourceIP || ''))}&threatId=${encodeURIComponent(String(threat.id))}${focusedAlertId ? `&alertId=${encodeURIComponent(focusedAlertId)}` : ''}`)}
                          >
                            {tx('map.openFlow', 'Open Flow')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setLocation(`/security-center?tab=threats&from=map&src=${encodeURIComponent(String(threat.sourceIP || ''))}&threatId=${encodeURIComponent(String(threat.id))}${focusedAlertId ? `&alertId=${encodeURIComponent(focusedAlertId)}` : ''}`)}
                          >
                            {tx('map.openThreatLog', 'Open Threat Log')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setLocation(`/security-center?tab=alerts&from=map&threatId=${encodeURIComponent(String(threat.id))}&src=${encodeURIComponent(String(threat.sourceIP || ''))}${focusedAlertId ? `&alertId=${encodeURIComponent(focusedAlertId)}` : ''}`)}
                          >
                            {tx('map.openAlerts', 'Open Alerts')}
                          </Button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : sourceIpFilter && threatsWithLocation.length > 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-muted px-4 text-center gap-3">
                <p className="text-muted-foreground">
                  {tx('map.noDataForSource', 'No map points found for selected source IP.')}
                </p>
                <Button type="button" variant="outline" onClick={() => setLocation('/map')}>
                  {tx('map.clearSourceFilter', 'Clear source filter')}
                </Button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">{t('map.noData')}</p>
              </div>
            )}
          </div>

          {sourceIpFilter && (
            <div className="mt-3 px-4 sm:px-0 flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{tx('map.filteredBySource', 'Filtered by source')} {sourceIpFilter}</Badge>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLocation('/map')}>
                {tx('map.clearSourceFilter', 'Clear source filter')}
              </Button>
            </div>
          )}

          <div className="mt-4 p-4 sm:p-0 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="text-sm font-medium">{t('map.legend')}:</div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <span className="text-sm">{t('threats.severityLevels.critical')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-5" />
                <span className="text-sm">{t('threats.severityLevels.high')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-4" />
                <span className="text-sm">{t('threats.severityLevels.medium')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-3" />
                <span className="text-sm">{t('threats.severityLevels.low')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

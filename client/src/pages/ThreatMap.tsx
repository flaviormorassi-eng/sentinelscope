import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Threat, ThreatEvent, UserPreferences } from '@shared/schema';
import { format } from 'date-fns';
import { useLocation, useSearch } from 'wouter';
import 'leaflet/dist/leaflet.css';
import { Compass, Crosshair, Globe2, Layers3 } from 'lucide-react';

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
const MARKER_COLOR_BY_SEVERITY = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
} as const;

const MAX_VISIBLE_MARKERS = 400;

const createThreatIcon = (severity: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${MARKER_COLOR_BY_SEVERITY[severity as keyof typeof MARKER_COLOR_BY_SEVERITY] || MARKER_COLOR_BY_SEVERITY.medium};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const createClusterIcon = (count: number, severity: string) => {
  const bg = MARKER_COLOR_BY_SEVERITY[severity as keyof typeof MARKER_COLOR_BY_SEVERITY] || MARKER_COLOR_BY_SEVERITY.medium;
  const size = count >= 100 ? 38 : count >= 20 ? 34 : 30;
  return L.divIcon({
    className: 'cluster-marker',
    html: `<div style="
      background-color: ${bg};
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
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

type ClusterPoint = {
  id: string;
  lat: number;
  lon: number;
  count: number;
  severity: string;
  items: MapThreatWithLocation[];
};

const severityRank: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function hasLocation(t: MapThreat): t is MapThreatWithLocation {
  const latRaw = (t as any).sourceLat;
  const lonRaw = (t as any).sourceLon;
  if (latRaw === null || latRaw === undefined || lonRaw === null || lonRaw === undefined) return false;
  const lat = Number.parseFloat(String(latRaw));
  const lon = Number.parseFloat(String(lonRaw));
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function MapUpdater({ threats, fitModeKey }: { threats: MapThreat[]; fitModeKey: string }) {
  const map = useMap();
  const hasAutoFittedRef = useRef(false);
  const lastTargetedFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!threats.length) return;

    const bounds = threats
      .filter(hasLocation)
      .map(t => [parseFloat(t.sourceLat), parseFloat(t.sourceLon)] as [number, number]);

    if (!bounds.length) return;

    if (fitModeKey === 'auto') {
      if (hasAutoFittedRef.current) return;
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      hasAutoFittedRef.current = true;
      return;
    }

    if (lastTargetedFitKeyRef.current === fitModeKey) return;
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    lastTargetedFitKeyRef.current = fitModeKey;
  }, [threats, map, fitModeKey]);

  useEffect(() => {
    if (fitModeKey !== 'auto') {
      hasAutoFittedRef.current = false;
    }
  }, [fitModeKey]);

  return null;
}

function ThreatMarkersLayer({
  threats,
  viewportOnly,
  clusterMode,
  selectedThreatId,
  onSelectThreat,
  markerRefs,
  firstFilteredMarkerRef,
  sourceIpFilter,
  focusedThreatId,
  threatIconsBySeverity,
  getSeverityBadgeVariant,
  t,
  tx,
  setLocation,
  focusedAlertId,
  onVisibleCountChange,
}: {
  threats: MapThreatWithLocation[];
  viewportOnly: boolean;
  clusterMode: boolean;
  selectedThreatId: string;
  onSelectThreat: (id: string) => void;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
  firstFilteredMarkerRef: React.MutableRefObject<L.Marker | null>;
  sourceIpFilter: string;
  focusedThreatId: string;
  threatIconsBySeverity: Record<string, L.DivIcon>;
  getSeverityBadgeVariant: (severity: string) => 'destructive' | 'default' | 'secondary' | 'outline';
  t: (key: string) => string;
  tx: (key: string, fallback: string) => string;
  setLocation: (to: string) => void;
  focusedAlertId: string;
  onVisibleCountChange: (count: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      setMapBounds(map.getBounds());
    },
    zoomend: () => {
      setMapBounds(map.getBounds());
    },
  });
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(() => map.getBounds());
  const clusterIconCacheRef = useRef<Record<string, L.DivIcon>>({});

  const zoom = map.getZoom();
  const clusterPrecision = useMemo(() => {
    if (zoom >= 9) return 0.2;
    if (zoom >= 7) return 0.35;
    if (zoom >= 5) return 0.7;
    if (zoom >= 3) return 1.4;
    return 3;
  }, [zoom]);

  const visibleThreats = useMemo(() => {
    if (!viewportOnly || !mapBounds) return threats;
    return threats.filter((threat) => {
      const lat = parseFloat(threat.sourceLat);
      const lon = parseFloat(threat.sourceLon);
      return mapBounds.contains([lat, lon]);
    });
  }, [threats, viewportOnly, mapBounds]);

  const effectiveClusterMode = clusterMode && !focusedThreatId;

  const clusterPoints = useMemo<ClusterPoint[]>(() => {
    if (!effectiveClusterMode) return [];

    const buckets = new Map<string, ClusterPoint>();
    for (const threat of visibleThreats) {
      const lat = parseFloat(threat.sourceLat);
      const lon = parseFloat(threat.sourceLon);
      const latBucket = Math.round(lat / clusterPrecision) * clusterPrecision;
      const lonBucket = Math.round(lon / clusterPrecision) * clusterPrecision;
      const key = `${latBucket.toFixed(4)}:${lonBucket.toFixed(4)}`;

      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          id: key,
          lat: latBucket,
          lon: lonBucket,
          count: 1,
          severity: threat.severity,
          items: [threat],
        });
        continue;
      }

      existing.count += 1;
      existing.items.push(threat);
      if ((severityRank[threat.severity] || 0) > (severityRank[existing.severity] || 0)) {
        existing.severity = threat.severity;
      }
    }

    return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  }, [effectiveClusterMode, visibleThreats, clusterPrecision]);

  const visibleMarkerPoints = useMemo(() => {
    if (!effectiveClusterMode) return visibleThreats;
    return clusterPoints.filter((point) => point.count === 1).map((point) => point.items[0]);
  }, [effectiveClusterMode, clusterPoints, visibleThreats]);

  useEffect(() => {
    if (!selectedThreatId) return;

    const selected = threats.find((threat) => String(threat.id) === selectedThreatId);
    if (!selected) return;

    const lat = parseFloat(selected.sourceLat);
    const lon = parseFloat(selected.sourceLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    map.setView([lat, lon], Math.max(map.getZoom(), 6), { animate: true });

    const timer = setTimeout(() => {
      try {
        markerRefs.current[selectedThreatId]?.openPopup();
      } catch {
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [selectedThreatId, threats, map, markerRefs]);

  useEffect(() => {
    if (effectiveClusterMode) {
      onVisibleCountChange(clusterPoints.length);
      return;
    }
    onVisibleCountChange(visibleThreats.length);
  }, [effectiveClusterMode, clusterPoints.length, visibleThreats.length, onVisibleCountChange]);

  return (
    <>
      {effectiveClusterMode && clusterPoints.filter((point) => point.count > 1).map((point) => {
        const cacheKey = `${point.severity}:${point.count >= 100 ? 'lg' : point.count >= 20 ? 'md' : 'sm'}`;
        const icon = clusterIconCacheRef.current[cacheKey] || createClusterIcon(point.count, point.severity);
        clusterIconCacheRef.current[cacheKey] = icon;

        return (
          <Marker
            key={`cluster-${point.id}`}
            position={[point.lat, point.lon]}
            icon={icon}
            eventHandlers={{
              click: () => {
                const nextZoom = Math.min((map.getZoom() || 2) + 2, 12);
                map.setView([point.lat, point.lon], nextZoom, { animate: true });
              },
            }}
          >
            <Popup>
              <div className="p-1 min-w-[220px] max-w-[280px]">
                <p className="font-medium text-sm">{tx('map.clusterSummary', 'Threat cluster')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tx('map.clusterContains', 'Contains')} {point.count} {tx('map.clusterEvents', 'events')}
                </p>
                <div className="mt-2 space-y-1 max-h-28 overflow-auto border-t pt-2">
                  {point.items.slice(0, 4).map((item) => (
                    <div key={String(item.id)} className="text-xs">
                      <div className="flex items-center gap-1">
                        <Badge variant={getSeverityBadgeVariant(item.severity)} className="h-4 px-1 text-[10px]">
                          {t(`threats.severityLevels.${item.severity}`)}
                        </Badge>
                        <span className="truncate">{(item as any).threatType || (item as any).type || t('threats.unknown')}</span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{item.sourceIP}</p>
                    </div>
                  ))}
                </div>
                {point.count > 4 && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    +{point.count - 4} {tx('map.moreThreatsInCluster', 'more threats in this cluster')}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {visibleMarkerPoints.map((threat, index) => (
        <Marker
          key={threat.id}
          position={[parseFloat(threat.sourceLat!), parseFloat(threat.sourceLon!)]}
          icon={threatIconsBySeverity[threat.severity] || threatIconsBySeverity.medium}
          eventHandlers={{
            click: () => onSelectThreat(String(threat.id)),
          }}
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
    </>
  );
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
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [viewportOnly, setViewportOnly] = useState(true);
  const [clusterMode, setClusterMode] = useState(true);
  const [selectedThreatId, setSelectedThreatId] = useState('');
  const [visibleMarkerCount, setVisibleMarkerCount] = useState(0);
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);

  const threatIconsBySeverity = useMemo<Record<string, L.DivIcon>>(() => ({
    critical: createThreatIcon('critical'),
    high: createThreatIcon('high'),
    medium: createThreatIcon('medium'),
    low: createThreatIcon('low'),
  }), []);

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
    staleTime: 10000,
  });

  const threatsWithLocation = useMemo(() => {
    return (threats as MapThreat[])
      .filter((t: any) => t.sourceLat && t.sourceLon)
      .map(t => t as MapThreatWithLocation);
  }, [threats]);

  const visibleThreatsWithLocation = useMemo(() => {
    if (!sourceIpFilter) return threatsWithLocation;
    const wanted = sourceIpFilter.toLowerCase();
    return threatsWithLocation.filter((t) => (t.sourceIP || '').toLowerCase() === wanted);
  }, [threatsWithLocation, sourceIpFilter]);

  const sortedVisibleThreats = useMemo(() => {
    return [...visibleThreatsWithLocation].sort((a, b) => {
      const aRaw = (a as any).timestamp ?? (a as any).createdAt;
      const bRaw = (b as any).timestamp ?? (b as any).createdAt;
      const aTs = aRaw ? new Date(aRaw).getTime() : 0;
      const bTs = bRaw ? new Date(bRaw).getTime() : 0;
      return bTs - aTs;
    });
  }, [visibleThreatsWithLocation]);

  const renderedThreats = useMemo(() => {
    if (showAllMarkers || sortedVisibleThreats.length <= MAX_VISIBLE_MARKERS) {
      return sortedVisibleThreats;
    }
    return sortedVisibleThreats.slice(0, MAX_VISIBLE_MARKERS);
  }, [showAllMarkers, sortedVisibleThreats]);

  const hiddenThreatCount = Math.max(0, sortedVisibleThreats.length - renderedThreats.length);

  const latestVisibleThreats = useMemo(() => {
    return sortedVisibleThreats.slice(0, 6);
  }, [sortedVisibleThreats]);

  const fitModeKey = focusedThreatId
    ? `focused:${focusedThreatId}`
    : sourceIpFilter
      ? `source:${sourceIpFilter}`
      : 'auto';

  useEffect(() => {
    if (!focusedThreatId) return;
    setSelectedThreatId(focusedThreatId);
  }, [focusedThreatId]);

  useEffect(() => {
    if (!selectedThreatId) return;
    if (sortedVisibleThreats.some((threat) => String(threat.id) === selectedThreatId)) return;
    setSelectedThreatId('');
  }, [selectedThreatId, sortedVisibleThreats]);

  useEffect(() => {
    setShowAllMarkers(false);
    setSelectedThreatId('');
  }, [sourceIpFilter]);

  useEffect(() => {
    const node = mapHostRef.current;
    if (!node || isMapVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsMapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isMapVisible]);

  useEffect(() => {
    markerRefs.current = {};
    firstFilteredMarkerRef.current = null;

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
    if (!renderedThreats.length) return;

    const timer = setTimeout(() => {
      try {
        firstFilteredMarkerRef.current?.openPopup();
      } catch {
        // noop
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [focusedThreatId, sourceIpFilter, renderedThreats]);

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
      <Card className="relative overflow-hidden border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-chart-4/10" />
        <CardContent className="relative p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-md border bg-background/70 px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5 text-primary" />
                {tx('map.commandCore', 'Global Threat Command')}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('map.title')}</h1>
              <p className="text-sm text-muted-foreground">{tx('map.subtitle', 'Track hostile origins, isolate active signals, and pivot across investigations in real time.')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-md border bg-background/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tx('map.signalLayer', 'Signal Layer')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" />{clusterMode ? tx('map.clusterModeOn', 'Cluster Mode') : tx('map.clusterModeOff', 'Raw Markers')}</p>
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tx('map.viewportState', 'Viewport State')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><Compass className="h-4 w-4 text-chart-4" />{viewportOnly ? tx('map.optimized', 'Optimized') : tx('map.fullWorld', 'Full World')}</p>
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tx('map.focusStatus', 'Focus Status')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><Crosshair className="h-4 w-4 text-chart-5" />{selectedThreatId ? tx('map.lockedTarget', 'Locked Target') : tx('map.wideSweep', 'Wide Sweep')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {focusedThreatId && (
            <Badge variant="outline" className="font-mono text-xs max-w-full truncate bg-background/70">
              {tx('map.focusedThreat', 'Focused threat')}: {focusedThreatId}
            </Badge>
          )}
          {focusedAlertId && (
            <Badge variant="outline" className="font-mono text-xs max-w-full truncate bg-background/70">
              {tx('map.focusedAlert', 'Focused alert')}: {focusedAlertId}
            </Badge>
          )}
          {fromAlerts && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation(returnAlertsHref)}>
              {tx('map.returnToAlerts', 'Return to Alerts')}
            </Button>
          )}
          {fromFlow && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation(returnFlowHref)}>
              {tx('map.returnToFlow', 'Return to Flow')}
            </Button>
          )}
          {fromThreats && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation(returnThreatsHref)}>
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

      <Card className="border-border/60 overflow-hidden">
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
          <div ref={mapHostRef} className="sm:rounded-lg overflow-hidden border-y sm:border" style={{ height: '65vh', maxHeight: '600px', minHeight: '400px' }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : !isMapVisible ? (
              <div className="h-full flex flex-col items-center justify-center bg-muted gap-3 px-4 text-center">
                <p className="text-muted-foreground">{tx('map.preparingMap', 'Preparing map view...')}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsMapVisible(true)}>
                  {tx('map.loadMapNow', 'Load map now')}
                </Button>
              </div>
            ) : renderedThreats.length > 0 ? (
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater threats={renderedThreats} fitModeKey={fitModeKey} />
                <ThreatMarkersLayer
                  threats={renderedThreats}
                  viewportOnly={viewportOnly}
                  clusterMode={clusterMode}
                  selectedThreatId={selectedThreatId}
                  onSelectThreat={setSelectedThreatId}
                  markerRefs={markerRefs}
                  firstFilteredMarkerRef={firstFilteredMarkerRef}
                  sourceIpFilter={sourceIpFilter}
                  focusedThreatId={focusedThreatId}
                  threatIconsBySeverity={threatIconsBySeverity}
                  getSeverityBadgeVariant={getSeverityBadgeVariant}
                  t={t}
                  tx={tx}
                  setLocation={setLocation}
                  focusedAlertId={focusedAlertId}
                  onVisibleCountChange={setVisibleMarkerCount}
                />
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

          {hiddenThreatCount > 0 && (
            <div className="mt-3 px-4 sm:px-0 flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {tx('map.showingRecentPoints', 'Showing most recent points')}: {renderedThreats.length}/{sortedVisibleThreats.length}
              </Badge>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllMarkers(true)}>
                {tx('map.showAllPoints', 'Show all points')}
              </Button>
            </div>
          )}

          <div className="mt-3 px-4 sm:px-0 flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {tx('map.visibleOnScreen', 'Visible on screen')}: {visibleMarkerCount}
            </Badge>
            {selectedThreatId && (
              <>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {tx('map.selectedThreat', 'Selected threat')}: {selectedThreatId}
                </Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedThreatId('')}>
                  {tx('map.clearFocusedThreat', 'Clear focused threat')}
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setClusterMode((prev) => !prev)}>
              {clusterMode
                ? tx('map.disableClusterMode', 'Disable cluster mode')
                : tx('map.enableClusterMode', 'Enable cluster mode')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setViewportOnly((prev) => !prev)}>
              {viewportOnly
                ? tx('map.showAllInViewportMode', 'Disable viewport optimization')
                : tx('map.enableViewportMode', 'Enable viewport optimization')}
            </Button>
          </div>

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

          {latestVisibleThreats.length > 0 && (
            <div className="mt-4 px-4 sm:px-0 space-y-2">
              <div className="text-sm font-medium">{tx('map.visibleThreatDetails', 'Visible threat details')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {latestVisibleThreats.map((threat) => (
                  <button
                    key={String(threat.id)}
                    type="button"
                    aria-pressed={selectedThreatId === String(threat.id)}
                    className={`rounded-md border p-2 text-xs bg-background/40 text-left hover:bg-accent/40 transition-colors ${
                      selectedThreatId === String(threat.id) ? 'ring-2 ring-primary border-primary/50 bg-accent/40' : ''
                    }`}
                    onClick={() => {
                      setShowAllMarkers(true);
                      setViewportOnly(false);
                      setClusterMode(false);
                      setIsMapVisible(true);
                      setSelectedThreatId(String(threat.id));
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                        {t(`threats.severityLevels.${threat.severity}`)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {(() => {
                          const rawTs = (threat as any).timestamp ?? (threat as any).createdAt;
                          if (!rawTs) return '-';
                          const d = new Date(rawTs);
                          return Number.isNaN(d.getTime()) ? '-' : format(d, 'HH:mm:ss');
                        })()}
                      </span>
                    </div>
                    <p className="mt-1 font-medium truncate">{(threat as any).description || (threat as any).threatType || (threat as any).type || t('threats.unknown')}</p>
                    <p className="font-mono text-muted-foreground truncate">{threat.sourceIP} → {(threat as any).targetIP || '-'}</p>
                    <p className="text-muted-foreground truncate">{threat.sourceCity}, {threat.sourceCountry}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{tx('map.focusThreat', 'Click to focus on map')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

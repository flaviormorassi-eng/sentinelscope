import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Threat, ThreatEvent, UserPreferences } from '@shared/schema';
import { format } from 'date-fns';
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
  return typeof (t as any).sourceLat === 'string' && typeof (t as any).sourceLon === 'string';
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
  const mapRef = useRef(null);

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  // Server decides data based on monitoring mode; single endpoint keeps client simple
  const mapQueryKey = '/api/threats/map';

  const { data: threats = [], isLoading } = useQuery<MapThreat[]>({
    queryKey: [mapQueryKey],
    enabled: !!preferences,
  });

  const threatsWithLocation = (threats as MapThreat[])
    .filter((t: any) => t.sourceLat && t.sourceLon)
    .map(t => t as MapThreatWithLocation);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('map.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {t('map.attackOrigins')}
            </CardTitle>
            <Badge variant="destructive">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1.5" />
              {t('map.liveIndicator')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border" style={{ height: '600px' }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : threatsWithLocation.length > 0 ? (
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater threats={threatsWithLocation} />
                {threatsWithLocation.map((threat) => (
                  <Marker
                    key={threat.id}
                    position={[parseFloat(threat.sourceLat!), parseFloat(threat.sourceLon!)]}
                    icon={createThreatIcon(threat.severity)}
                  >
                    <Popup>
                      <div className="p-1 min-w-[250px]">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                            {t(`threats.severityLevels.${threat.severity}`)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date((threat as any).timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                        <p className="font-medium mb-1">{(threat as any).description}</p>
                        <p className="text-xs text-muted-foreground mb-1">
                          {t(`threats.types.${(threat as any).type}`)}
                        </p>
                        <div className="text-xs font-mono space-y-1 mt-2 pt-2 border-t">
                          <p><strong>Source:</strong> {threat.sourceIP}</p>
                          <p><strong>Location:</strong> {threat.sourceCity}, {threat.sourceCountry}</p>
                          <p><strong>Target:</strong> {(threat as any).targetIP}</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">{t('map.noData')}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-6">
            <div className="text-sm font-medium">{t('map.legend')}:</div>
            <div className="flex items-center gap-4">
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

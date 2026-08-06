import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { WakerProfile } from '@/hooks/useNearbyWakers';

interface Props {
  wakers: WakerProfile[];
  myLat?: number | null;
  myLng?: number | null;
}

function Recenter({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], map.getZoom() < 11 ? 12 : map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export function WakeMapView({ wakers, myLat, myLng }: Props) {
  const center: [number, number] = [myLat ?? 23.8103, myLng ?? 90.4125];

  const points = useMemo(() => wakers.filter(w => w.lat != null && w.lng != null), [wakers]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#111118]">
      <div className="h-[300px] relative">
        <MapContainer
          center={center}
          zoom={11}
          style={{ height: '100%', width: '100%', background: '#0A0A0F' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM &copy; CARTO'
          />
          <Recenter lat={myLat} lng={myLng} />

          {myLat != null && myLng != null && (
            <CircleMarker
              center={[myLat, myLng]}
              radius={9}
              pathOptions={{ color: '#6C63FF', fillColor: '#6C63FF', fillOpacity: 1, weight: 3 }}
              className="animate-pulse"
            >
              <Popup>You</Popup>
            </CircleMarker>
          )}

          {points.map(w => {
            const active = !!w.status_text;
            const color = active ? '#00E676' : '#FFD740';
            return (
              <CircleMarker
                key={w.id}
                center={[w.lat as number, w.lng as number]}
                radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 }}
              >
                <Popup>
                  <div style={{ color: '#000', fontSize: 12 }}>
                    <strong>{w.is_anonymous ? 'Anonymous' : w.display_name}</strong>
                    <div>{new Date(w.woke_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {w.status_text && <div style={{ fontStyle: 'italic' }}>{w.status_emoji} {w.status_text}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-white/60 px-3 py-2 border-t border-white/10">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#00E676]" /> Active</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FFD740]" /> Silent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#6C63FF]" /> You</span>
      </div>
    </div>
  );
}

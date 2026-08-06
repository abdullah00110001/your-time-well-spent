import { useMemo } from 'react';
import type { WakerProfile } from '@/hooks/useNearbyWakers';

// Bangladesh bounding box approx:
// lat: 20.74 – 26.63  (south to north)
// lng: 88.02 – 92.67  (west to east)

const MAP_W = 340;
const MAP_H = 380;

const LNG_MIN = 88.0;
const LNG_MAX = 92.75;
const LAT_MIN = 20.7;
const LAT_MAX = 26.65;

function toXY(lat: number, lng: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return [x, y];
}

// ── Divisions as SVG paths (simplified polygons) ─────────────────────────────
// Points are [lng, lat] pairs converted inline via toXY

interface Division {
  name: string;
  color: string;
  glowColor: string;
  // polygon points as [lng, lat]
  coords: [number, number][];
  // city names mapped for matching wakers
  cities: string[];
}

const DIVISIONS: Division[] = [
  {
    name: 'Dhaka',
    color: '#6C63FF',
    glowColor: 'rgba(108,99,255,0.4)',
    coords: [
      [89.8, 24.6], [90.7, 24.6], [91.0, 24.1], [90.9, 23.5],
      [90.4, 23.2], [89.9, 23.3], [89.6, 23.8], [89.7, 24.3],
    ],
    cities: ['Dhaka', 'Narayanganj', 'Gazipur', 'Manikganj', 'Narsingdi', 'Munshiganj', 'Tangail', 'Faridpur', 'Madaripur', 'Gopalganj', 'Rajbari', 'Shariatpur', 'Kishoreganj'],
  },
  {
    name: 'Chittagong',
    color: '#FF6B6B',
    glowColor: 'rgba(255,107,107,0.4)',
    coords: [
      [91.0, 24.1], [92.5, 23.8], [92.6, 22.8], [92.2, 21.8],
      [91.8, 21.3], [91.2, 21.5], [90.9, 22.2], [90.7, 23.0],
      [90.9, 23.5],
    ],
    cities: ['Chittagong', 'Cox\'s Bazar', 'Rangamati', 'Bandarban', 'Khagrachhari', 'Feni', 'Comilla', 'Noakhali', 'Chandpur', 'Lakshmipur', 'Brahmanbaria'],
  },
  {
    name: 'Rajshahi',
    color: '#FFD740',
    glowColor: 'rgba(255,215,64,0.4)',
    coords: [
      [88.1, 25.2], [89.0, 25.3], [89.5, 24.8], [89.8, 24.6],
      [89.7, 24.3], [89.6, 23.8], [89.0, 23.9], [88.5, 24.1],
      [88.1, 24.5],
    ],
    cities: ['Rajshahi', 'Chapainawabganj', 'Naogaon', 'Natore', 'Sirajganj', 'Pabna', 'Bogura', 'Joypurhat'],
  },
  {
    name: 'Khulna',
    color: '#00E676',
    glowColor: 'rgba(0,230,118,0.4)',
    coords: [
      [88.5, 24.1], [89.0, 23.9], [89.6, 23.8], [89.9, 23.3],
      [90.4, 23.2], [89.8, 22.5], [89.3, 22.0], [88.8, 21.8],
      [88.4, 22.5], [88.1, 23.2], [88.1, 24.1],
    ],
    cities: ['Khulna', 'Bagerhat', 'Satkhira', 'Jessore', 'Narail', 'Magura', 'Jhenaidah', 'Kushtia', 'Chuadanga', 'Meherpur'],
  },
  {
    name: 'Sylhet',
    color: '#40C8E0',
    glowColor: 'rgba(64,200,224,0.4)',
    coords: [
      [91.0, 25.2], [92.5, 25.2], [92.6, 24.6], [92.5, 23.8],
      [91.0, 24.1], [90.9, 24.5],
    ],
    cities: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  },
  {
    name: 'Barisal',
    color: '#FF9F43',
    glowColor: 'rgba(255,159,67,0.4)',
    coords: [
      [89.9, 23.3], [90.4, 23.2], [90.9, 22.2], [90.6, 21.8],
      [90.2, 21.5], [89.8, 21.8], [89.3, 22.0], [89.8, 22.5],
    ],
    cities: ['Barisal', 'Bhola', 'Patuakhali', 'Barguna', 'Pirojpur', 'Jhalokathi'],
  },
  {
    name: 'Rangpur',
    color: '#FF78C4',
    glowColor: 'rgba(255,120,196,0.4)',
    coords: [
      [88.1, 26.6], [89.9, 26.6], [89.9, 25.7], [89.5, 25.3],
      [89.0, 25.3], [88.1, 25.2],
    ],
    cities: ['Rangpur', 'Dinajpur', 'Thakurgaon', 'Panchagarh', 'Nilphamari', 'Lalmonirhat', 'Kurigram', 'Gaibandha'],
  },
  {
    name: 'Mymensingh',
    color: '#A29BFE',
    glowColor: 'rgba(162,155,254,0.4)',
    coords: [
      [89.5, 25.3], [89.9, 25.7], [90.7, 25.2], [91.0, 25.2],
      [90.9, 24.5], [90.7, 24.6], [89.8, 24.6], [89.5, 24.8],
    ],
    cities: ['Mymensingh', 'Jamalpur', 'Sherpur', 'Netrokona'],
  },
];

function divisionForWaker(w: WakerProfile): Division | undefined {
  if (!w.city) return undefined;
  const cityLower = w.city.toLowerCase();
  return DIVISIONS.find(d =>
    d.cities.some(c => cityLower.includes(c.toLowerCase()) || c.toLowerCase().includes(cityLower))
  );
}

function polygonPoints(coords: [number, number][]): string {
  return coords.map(([lng, lat]) => {
    const [x, y] = toXY(lat, lng);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

interface Props {
  wakers: WakerProfile[];
  myLat?: number | null;
  myLng?: number | null;
}

export function BangladeshMapView({ wakers, myLat, myLng }: Props) {
  const dots = useMemo(() =>
    wakers.filter(w => w.lat != null && w.lng != null),
    [wakers]
  );

  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    wakers.forEach(w => {
      const div = divisionForWaker(w);
      if (div) counts[div.name] = (counts[div.name] || 0) + 1;
    });
    return counts;
  }, [wakers]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0D0D18]">
      {/* Map */}
      <div className="relative flex items-center justify-center py-3 px-2">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          width="100%"
          style={{ maxHeight: 360, display: 'block' }}
        >
          <defs>
            {DIVISIONS.map(d => (
              <filter key={`glow-${d.name}`} id={`glow-${d.name}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Division polygons */}
          {DIVISIONS.map(d => (
            <g key={d.name}>
              <polygon
                points={polygonPoints(d.coords)}
                fill={d.color}
                fillOpacity={0.18}
                stroke={d.color}
                strokeWidth="1.5"
                strokeOpacity={0.7}
              />
              {/* Division label */}
              {(() => {
                // centroid approx
                const xs = d.coords.map(([lng]) => toXY(0, lng)[0]);
                const ys = d.coords.map(([, lat]) => toXY(lat, 0)[1]);
                const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
                const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
                const count = divisionCounts[d.name];
                return (
                  <g>
                    <text
                      x={cx}
                      y={cy - (count ? 6 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="8"
                      fontWeight="600"
                      fill={d.color}
                      fillOpacity={0.9}
                      style={{ pointerEvents: 'none' }}
                    >
                      {d.name}
                    </text>
                    {count ? (
                      <text
                        x={cx}
                        y={cy + 7}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="7"
                        fill={d.color}
                        fillOpacity={0.7}
                        style={{ pointerEvents: 'none' }}
                      >
                        {count} waker{count > 1 ? 's' : ''}
                      </text>
                    ) : null}
                  </g>
                );
              })()}
            </g>
          ))}

          {/* Waker dots from lat/lng */}
          {dots.map(w => {
            const [x, y] = toXY(w.lat as number, w.lng as number);
            const active = !!w.status_text;
            const isMe = w.lat === myLat && w.lng === myLng;
            const color = isMe ? '#6C63FF' : active ? '#00E676' : '#FFD740';
            return (
              <g key={w.id} filter="url(#dotGlow)">
                <circle cx={x} cy={y} r={isMe ? 7 : 5} fill={color} fillOpacity={0.95} />
                <circle cx={x} cy={y} r={isMe ? 12 : 9} fill={color} fillOpacity={0.15} />
              </g>
            );
          })}

          {/* My location dot (if no lat/lng match) */}
          {myLat != null && myLng != null && !dots.find(w => w.lat === myLat && w.lng === myLng) && (() => {
            const [x, y] = toXY(myLat, myLng);
            return (
              <g filter="url(#dotGlow)">
                <circle cx={x} cy={y} r={7} fill="#6C63FF" fillOpacity={0.95} />
                <circle cx={x} cy={y} r={13} fill="#6C63FF" fillOpacity={0.15} />
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/50 px-4 py-2.5 border-t border-white/[0.06]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00E676]" /> Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFD740]" /> Silent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#6C63FF]" /> You
        </span>
        <span className="ml-auto text-white/30">{dots.length} on map</span>
      </div>
    </div>
  );
}
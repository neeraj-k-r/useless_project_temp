import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Community } from '../types';
import { MapPin, Zap, AlertTriangle, CheckCircle, Navigation } from 'lucide-react';

interface KeralaMapProps {
  communities: Community[];
  selectedCommunityId?: string;
  onSelectCommunity?: (id: string) => void;
  height?: string;
}

// Custom DivIcon generator for Outage statuses
const createMarkerIcon = (status: Community['status'], name: string) => {
  let colorClass = 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-emerald-500/50';
  let dotClass = 'bg-emerald-400';
  let badgeText = '🟢';

  if (status === 'VERIFIED_OUTAGE') {
    colorClass = 'bg-red-600 border-red-400 text-white shadow-red-600/60 animate-bounce';
    dotClass = 'bg-red-400 animate-ping';
    badgeText = '🔴';
  } else if (status === 'REPORTING') {
    colorClass = 'bg-amber-500 border-amber-300 text-slate-950 shadow-amber-500/50';
    dotClass = 'bg-amber-400 animate-ping';
    badgeText = '🟡';
  }

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer">
      <div class="w-8 h-8 rounded-full ${colorClass} border-2 flex items-center justify-center font-bold text-xs shadow-lg transition-transform group-hover:scale-125">
        ${badgeText}
      </div>
      <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full ${dotClass}"></div>
      <div class="mt-1 px-2 py-0.5 rounded-md bg-slate-950/90 text-white text-[10px] font-bold border border-slate-700 whitespace-nowrap shadow-md">
        ${name}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [36, 48],
    iconAnchor: [18, 24]
  });
};

function MapViewRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 12);
  }, [lat, lng, map]);
  return null;
}

export const KeralaMap: React.FC<KeralaMapProps> = ({
  communities,
  selectedCommunityId,
  onSelectCommunity,
  height = '400px'
}) => {
  const selectedComm = communities.find(c => c.id === selectedCommunityId) || communities[0];
  const centerLat = selectedComm ? selectedComm.lat : 10.0159;
  const centerLng = selectedComm ? selectedComm.lng : 76.3419;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      {/* Map Header Overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs flex items-center gap-2 shadow-lg">
        <MapPin className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-bold text-white">Kerala Community Grid</span>
        <span className="text-[10px] text-amber-400/90 font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
          {selectedComm ? `${selectedComm.name} (${selectedComm.district})` : 'Kerala Grid'}
        </span>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-slate-300 font-medium">🔴 Active Outage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-slate-300 font-medium">🟡 Reporting Outage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300 font-medium">🟢 Power Normal</span>
        </div>
      </div>

      <div style={{ height }} className="w-full">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#090d16' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <MapViewRecenter lat={centerLat} lng={centerLng} />

          {communities.map((comm) => (
            <Marker
              key={comm.id}
              position={[comm.lat, comm.lng]}
              icon={createMarkerIcon(comm.status, comm.name)}
              eventHandlers={{
                click: () => onSelectCommunity?.(comm.id)
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-1 text-slate-950 min-w-[170px]">
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{comm.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 font-mono">
                      {comm.pincode}
                    </span>
                  </div>

                  <div className="mt-2 text-xs space-y-1">
                    <p>
                      <strong>Status:</strong>{' '}
                      {comm.status === 'VERIFIED_OUTAGE' ? (
                        <span className="text-red-600 font-bold">🔴 Outage Active</span>
                      ) : comm.status === 'REPORTING' ? (
                        <span className="text-amber-600 font-bold">🟡 Reports Pending ({comm.activeReportsCount}/{comm.outageThreshold})</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">🟢 Power Available</span>
                      )}
                    </p>
                    <p className="text-slate-600">
                      {comm.district} District
                    </p>
                  </div>

                  {onSelectCommunity && (
                    <button
                      onClick={() => onSelectCommunity(comm.id)}
                      className="mt-3 w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                    >
                      Select {comm.name}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

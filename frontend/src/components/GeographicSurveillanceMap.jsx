import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { FiMapPin, FiMail, FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiLayers, FiSend } from 'react-icons/fi';
import 'leaflet/dist/leaflet.css';

// Custom CSS styling for critical pulse animation
const pulseStyle = `
  @keyframes circlePulse {
    0% { r: 32px; opacity: 0.6; stroke-width: 1px; }
    50% { r: 48px; opacity: 0.1; stroke-width: 3px; }
    100% { r: 32px; opacity: 0.6; stroke-width: 1px; }
  }
  .leaflet-critical-pulse-path {
    animation: circlePulse 2.5s infinite ease-in-out;
    transform-origin: center;
  }
`;

function ChangeView({ phcs, resetTrigger, selectedPhc }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedPhc && selectedPhc.latitude !== null && selectedPhc.longitude !== null) {
      map.setView([selectedPhc.latitude, selectedPhc.longitude], 11, { animate: true });
      return;
    }

    const validPhcs = phcs.filter(p => p.latitude !== null && p.longitude !== null);
    if (validPhcs.length === 0) return;
    
    if (validPhcs.length === 1) {
      map.setView([validPhcs[0].latitude, validPhcs[0].longitude], 12);
    } else {
      const coords = validPhcs.map(p => [p.latitude, p.longitude]);
      map.fitBounds(coords, { padding: [50, 50] });
    }
  }, [phcs, map, resetTrigger, selectedPhc]);

  return null;
}

export default function GeographicSurveillanceMap({ 
  phcs = [], 
  alertHistory = [], 
  onNotifyPhc = null,
  notifyLoading = {},
  selectedPhcProp = null
}) {
  const [selectedPhc, setSelectedPhc] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [pulseRadius, setPulseRadius] = useState(32);

  // Sync selected PHC from external trigger
  useEffect(() => {
    if (selectedPhcProp) {
      setSelectedPhc(selectedPhcProp);
    }
  }, [selectedPhcProp]);

  // Pulse animation using React state to guarantee cross-browser compatibility
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRadius(prev => (prev === 32 ? 46 : 32));
    }, 1250);
    return () => clearInterval(interval);
  }, []);

  const validPhcs = phcs.filter(p => p.latitude !== null && p.longitude !== null);
  const totalPHCs = phcs.length;
  const configuredPHCs = validPhcs.length;
  
  const activeCriticalCount = phcs.filter(p => p.risk_level === 'CRITICAL').length;
  const highRiskCount = phcs.filter(p => p.risk_level === 'HIGH').length;
  const nearbyAlertsCount = phcs.reduce((sum, p) => sum + (p.active_alert_count || 0), 0);

  const handleResetView = () => {
    setSelectedPhc(null);
    setResetTrigger(prev => prev + 1);
  };

  const getRadius = (score) => {
    if (score === null || score === undefined) return 10;
    if (score < 25.0) return 10;
    if (score < 50.0) return 16;
    if (score < 75.0) return 23;
    return 32;
  };

  const getColor = (level) => {
    if (level === 'CRITICAL') return '#EF4444'; // Red
    if (level === 'HIGH') return '#F97316'; // Orange
    if (level === 'MEDIUM') return '#FBBF24'; // Yellow
    if (level === 'LOW') return '#10B981'; // Green
    return '#9CA3AF'; // Gray
  };

  const getSeverityBgClass = (level) => {
    if (level === 'CRITICAL') return 'bg-red-50 border-red-200 text-red-700';
    if (level === 'HIGH') return 'bg-orange-50 border-orange-200 text-orange-700';
    if (level === 'MEDIUM') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-green-50 border-green-200 text-green-700';
  };

  // Find active alert details for the selected PHC
  const activeCriticalAlert = selectedPhc ? alertHistory.find(
    a => a.phc_id === selectedPhc.phc_id && a.severity === 'CRITICAL'
  ) : null;

  // Render empty state if no PHC has configured coordinates
  if (configuredPHCs === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-gray-300 bg-slate-50/50">
        <FiMapPin className="w-16 h-16 text-gray-300 mb-4 animate-bounce" />
        <h3 className="text-xl font-black text-gray-700 mb-2 uppercase tracking-wide">
          MAP LOCATIONS NOT CONFIGURED
        </h3>
        <p className="text-gray-500 max-w-md text-xs font-semibold leading-relaxed">
          PHC geographic coordinates have not been configured. District administrators must input latitude and longitude coordinates to enable the geographic map.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <style>{pulseStyle}</style>
      
      {/* Top Map Controls Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/70 border border-slate-200/50 rounded-2xl backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-gray-600">
          <div>
            <span className="text-gray-400">Monitored PHCs:</span> {totalPHCs}
          </div>
          <div>
            <span className="text-gray-400">Map Plotted:</span> {configuredPHCs} / {totalPHCs}
          </div>
          <div>
            <span className="text-gray-400 font-bold text-red-600">Active Critical:</span> {activeCriticalCount}
          </div>
          <div>
            <span className="text-gray-400 font-bold text-orange-600">High Risk:</span> {highRiskCount}
          </div>
          <div>
            <span className="text-gray-400 font-bold text-indigo-600">Nearby Alerts:</span> {nearbyAlertsCount}
          </div>
          {configuredPHCs < totalPHCs && (
            <div className="text-orange-600">
              {totalPHCs - configuredPHCs} PHC(s) missing coordinates
            </div>
          )}
        </div>
        <button
          onClick={handleResetView}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition duration-200 flex items-center gap-2"
        >
          <FiLayers /> Fit PHCs / Reset View
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column */}
        <div className="lg:col-span-2 h-[520px] border border-slate-200 rounded-2xl overflow-hidden shadow-md relative bg-slate-100">
          <MapContainer
            center={[10.9765, 77.0012]}
            zoom={10}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ChangeView phcs={phcs} resetTrigger={resetTrigger} selectedPhc={selectedPhc} />
            
            {validPhcs.map((phc) => {
              const radius = getRadius(phc.risk_score);
              const color = getColor(phc.risk_level);
              const isSelected = selectedPhc?.phc_id === phc.phc_id;
              
              return (
                <React.Fragment key={phc.phc_id}>
                  {/* Outer Pulsing Aura (Only for CRITICAL risk level) */}
                  {phc.risk_level === 'CRITICAL' && (
                    <CircleMarker
                      center={[phc.latitude, phc.longitude]}
                      radius={pulseRadius}
                      pathOptions={{
                        fillColor: '#EF4444',
                        fillOpacity: 0.12,
                        color: '#EF4444',
                        weight: 1,
                        stroke: true
                      }}
                    />
                  )}

                  {/* Primary Risk Circle Bubble */}
                  <CircleMarker
                    center={[phc.latitude, phc.longitude]}
                    radius={radius}
                    eventHandlers={{
                      click: () => {
                        setSelectedPhc(phc);
                      }
                    }}
                    pathOptions={{
                      fillColor: color,
                      fillOpacity: isSelected ? 0.85 : 0.6,
                      color: isSelected ? '#312E81' : color,
                      weight: isSelected ? 4 : 1.5
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-2 space-y-2 text-xs font-semibold text-slate-700 min-w-48">
                        <div className="border-b pb-1">
                          <div className="font-black text-slate-800 text-sm">
                            {phc.phc_name || phc.phc_id}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase">{phc.city}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Risk Score:</span>{' '}
                          <span className="font-bold text-slate-800">
                            {phc.risk_score !== null ? `${phc.risk_score.toFixed(1)} / 100` : 'Risk unavailable'}
                          </span>
                        </div>
                        {phc.risk_level ? (
                          <div>
                            <span className="text-gray-400 font-medium">Status:</span>{' '}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSeverityBgClass(phc.risk_level)}`}>
                              {phc.risk_level}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-gray-400 font-medium">Status:</span>{' '}
                            <span className="text-gray-500 italic">Risk unavailable</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 font-medium">Primary concern:</span>{' '}
                          <span className="font-bold text-slate-800">{phc.dominant_disease || 'None'}</span>
                        </div>
                        <button
                          onClick={() => setSelectedPhc(phc)}
                          className="w-full mt-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[10px] transition text-center uppercase tracking-wider block"
                        >
                          View Details
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Map Floating Legend (Standard symbols, no emojis) */}
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-md z-[1000] text-[10px] text-slate-700 font-bold max-w-xs space-y-2">
            <div className="text-xs font-black uppercase text-slate-800 tracking-wider">Surveillance Legends</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-white"></div>
                <span>LOW (0-25)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] border border-white"></div>
                <span>MEDIUM (25-50)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F97316] border border-white"></div>
                <span>HIGH (50-75)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white"></div>
                <span>CRITICAL (75-100)</span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2 space-y-1 font-semibold text-gray-500 leading-relaxed text-[9px]">
              <div>• Larger circle size indicates higher risk score.</div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block"></span>
                <span>Pulsing red circle represents critical surveillance alert.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {selectedPhc ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex-1 flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* PHC Header */}
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 bg-slate-100 text-gray-500 rounded text-[9px] font-bold tracking-wider uppercase">
                    {selectedPhc.phc_id}
                  </span>
                  <h3 className="text-lg font-black text-slate-800 mt-1">
                    {selectedPhc.phc_name || 'Name unavailable'}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                    {selectedPhc.city}, {selectedPhc.district} District
                  </p>
                </div>

                {/* Risk & Severity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Risk Score</span>
                    <span className="text-sm font-black text-slate-800">
                      {selectedPhc.risk_score !== null ? `${selectedPhc.risk_score.toFixed(1)} / 100` : 'Risk unavailable'}
                    </span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${getSeverityBgClass(selectedPhc.risk_level)}`}>
                    <span className="text-[10px] opacity-75 block font-bold uppercase">Risk Level</span>
                    <span className="text-sm font-black uppercase">
                      {selectedPhc.risk_level || 'Risk unavailable'}
                    </span>
                  </div>
                </div>

                {/* Patient Metrics, Dominant Disease & Trends */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center border-y border-slate-100">
                  <div className="py-1">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase">Patients</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedPhc.patient_count !== undefined ? selectedPhc.patient_count.toLocaleString() : '0'}
                    </span>
                  </div>
                  <div className="py-1 border-x border-slate-100">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase">Dominant Disease</span>
                    <span className="text-xs font-black text-slate-800 truncate block px-0.5">
                      {selectedPhc.dominant_disease || 'None'}
                    </span>
                  </div>
                  <div className="py-1">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase">Recent Change</span>
                    <span className={`text-xs font-black block ${selectedPhc.recent_change_percentage > 0 ? 'text-red-650' : 'text-green-650'}`}>
                      {selectedPhc.recent_change_percentage !== undefined ? `${selectedPhc.recent_change_percentage >= 0 ? '+' : ''}${selectedPhc.recent_change_percentage.toFixed(1)}%` : '0.0%'}
                    </span>
                  </div>
                </div>

                {/* Contact Email */}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Official PHC Contact</span>
                  <div className="flex items-center gap-2 p-2.5 bg-indigo-50/30 border border-indigo-100/30 rounded-2xl">
                    <FiMail className="text-indigo-500 text-sm flex-shrink-0" />
                    <span className="font-bold text-slate-700 break-all select-all">
                      {selectedPhc.email || 'PHC contact unavailable'}
                    </span>
                  </div>
                </div>

                {/* Proximity / Neighbors and email notifications */}
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Connected Neighbors & Notifications</span>
                  {selectedPhc.nearby_phcs && selectedPhc.nearby_phcs.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPhc.nearby_phcs.map((neighbor) => {
                        // Get notification status for this neighbor if active critical alert exists
                        const notif = activeCriticalAlert?.notifications?.find(
                          n => n.recipient_phc_id === neighbor.phc_id
                        );
                        
                        const statusText = notif ? notif.status_text : 'Not notified';
                        const status = notif ? notif.status : 'NONE';
                        const isSending = notifyLoading[`${activeCriticalAlert?.id}_${neighbor.phc_id}`];
                        
                        let statusColor = 'text-gray-500 bg-gray-50';
                        if (status === 'SENT') statusColor = 'text-green-700 bg-green-50 border-green-200';
                        else if (status === 'FAILED') statusColor = 'text-red-700 bg-red-50 border-red-200';
                        else if (status === 'PENDING') statusColor = 'text-amber-700 bg-amber-50 border-amber-200';

                        return (
                          <div key={neighbor.phc_id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-800 truncate">{neighbor.phc_name}</div>
                              <div className="text-[9px] text-gray-400 font-bold uppercase">Distance: {neighbor.distance_km} km</div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${statusColor}`}>
                                {isSending ? 'Sending...' : statusText}
                              </span>
                              
                              {/* Notify Button */}
                              {activeCriticalAlert && neighbor.email && (
                                <button
                                  disabled={status === 'SENT' || isSending}
                                  onClick={() => onNotifyPhc && onNotifyPhc(activeCriticalAlert.id, neighbor.phc_id)}
                                  className={`p-1.5 rounded-lg text-white transition ${
                                    status === 'SENT' 
                                      ? 'bg-gray-300 cursor-not-allowed' 
                                      : 'bg-indigo-600 hover:bg-indigo-700'
                                  }`}
                                  title={status === 'SENT' ? 'Already notified' : 'Trigger notification email'}
                                >
                                  <FiSend size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400 font-medium italic block">No neighbor connections configured</span>
                  )}
                </div>

                {/* Alert feed */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Surveillance Alerts</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-600">
                      {selectedPhc.active_alert_count} Active
                    </span>
                  </div>
                  
                  {selectedPhc.latest_alert ? (
                    <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-2xl flex gap-3">
                      <FiAlertTriangle className="text-amber-500 text-base mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 leading-normal font-semibold text-gray-600 text-[10px] max-h-24 overflow-y-auto">
                        {selectedPhc.latest_alert}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/20 border border-emerald-100 rounded-2xl flex gap-3 items-center">
                      <FiCheckCircle className="text-emerald-500 text-base flex-shrink-0" />
                      <span className="text-emerald-700 font-bold text-[10px]">No active surveillance alerts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons & Footer */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (onNotifyPhc && activeCriticalAlert && selectedPhc.nearby_phcs?.length > 0) {
                        const target = selectedPhc.nearby_phcs.find(n => n.email);
                        if (target) {
                          onNotifyPhc(activeCriticalAlert.id, target.phc_id);
                        }
                      }
                    }}
                    disabled={!activeCriticalAlert || !selectedPhc.nearby_phcs?.some(n => n.email)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition text-center uppercase tracking-wider disabled:bg-gray-250 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <FiSend /> Notify PHC
                  </button>
                  <button
                    onClick={() => handleResetView()}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition uppercase tracking-wider"
                  >
                    View PHC Details
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400">
                  <FiClock />
                  <span>Last Updated: {new Date(selectedPhc.updated_at).toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-8 text-center flex-1 flex flex-col items-center justify-center text-slate-400">
              <FiActivity className="w-10 h-10 mb-3 text-slate-300 animate-pulse" />
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">SELECT A PHC</h4>
              <p className="text-[11px] font-medium text-gray-450 mt-1 max-w-xs leading-normal">
                Click a risk bubble on the map to inspect location profiles, patient counts, dominant diseases, neighbor ranges, and trigger alert emails.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

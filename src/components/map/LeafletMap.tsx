'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, DatabaseZap, Loader2, CloudRain, Thermometer, Droplets, MapPin, AlertCircle, Leaf } from 'lucide-react';

export default function LeafletMap() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [polygon, setPolygon] = useState<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapRef.current) return;

        require('leaflet-draw');

        const map = L.map(mapRef.current, { zoomControl: false }).setView([30.7333, 76.7794], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            className: 'map-tiles'
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new (L.Control as any).Draw({
            draw: {
                polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#10b981', weight: 3, fillOpacity: 0.2 } },
                polyline: false, circle: false, rectangle: true, marker: false, circlemarker: false,
            },
            edit: { featureGroup: drawnItems }
        });
        map.addControl(drawControl);

        map.on((L.Draw as any).Event.CREATED, async (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);

            const geoJSON = layer.toGeoJSON();
            const bounds = layer.getBounds();
            const center = bounds.getCenter();

            setPolygon({
                geo: geoJSON,
                center_lat: center.lat,
                center_lng: center.lng,
                telemetry_status: 'SYNCING',
                gee_status: 'SYNCING',
                metrics: null
            });

            try {
                // 1. Neon DB Logger
                const telemetryRes = await fetch('/api/telemetry', {
                    method: 'POST',
                    body: JSON.stringify({ geo: geoJSON, center_lat: center.lat, center_lng: center.lng })
                });
                const telemetryData = await telemetryRes.json();
                setPolygon((prev: any) => ({ ...prev, telemetry_status: telemetryData.status, row_count: telemetryData.cluster_row_count }));

                if (telemetryData.logged_id) {
                    // 2. Python STAC Metric Proxy
                    const geeRes = await fetch('/api/gee', {
                        method: 'POST',
                        body: JSON.stringify({ geo: geoJSON, center_lat: center.lat, center_lng: center.lng })
                    });
                    const geeData = await geeRes.json();

                    setPolygon((prev: any) => ({ ...prev, gee_status: geeData.status, gee_error: geeData.error }));

                    if (geeData.status === 'SUCCESS' && geeData.metrics) {
                        const patchRes = await fetch('/api/telemetry', {
                            method: 'PATCH',
                            body: JSON.stringify({ logged_id: telemetryData.logged_id, metrics: geeData.metrics })
                        });
                        const patchData = await patchRes.json();
                        if (patchData.status === 'SUCCESS') {
                            setPolygon((prev: any) => ({
                                ...prev,
                                db_patch_status: 'is_data_complete',
                                gee_status: 'SUCCESSFUL_SYNC',
                                metrics: geeData.metrics
                            }));
                        }
                    }
                }
            } catch (e: any) {
                setPolygon((prev: any) => ({ ...prev, telemetry_status: 'ERROR', gee_status: 'ERROR' }));
            }
        });

        return () => { map.remove(); };
    }, []);

    return (
        <div className="w-full flex flex-col gap-6 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/40 border border-white/10">
                <div ref={mapRef} className="w-full h-[550px] z-0" />
                <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-2xl z-10" />

                {!polygon && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    >
                        <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium text-slate-200">Draw a target region on the map</span>
                        </div>
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {polygon && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-6"
                    >
                        {/* Header Status */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Target Locked</h3>
                                    <p className="text-slate-400 text-sm font-mono">{polygon.center_lat.toFixed(4)}N, {polygon.center_lng.toFixed(4)}E</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-white/5">
                                    <DatabaseZap className="w-3.5 h-3.5 text-blue-400" />
                                    <span className={polygon.telemetry_status === 'SUCCESS' ? 'text-blue-400' : 'text-slate-400'}>
                                        DB: {polygon.telemetry_status}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* STAC Extractor Status */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {polygon.gee_status === 'SYNCING' ? (
                                        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                                    ) : polygon.gee_status === 'SUCCESSFUL_SYNC' ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    )}
                                    <h4 className="text-slate-200 font-medium tracking-wide text-sm uppercase">Planetary Computer Link</h4>
                                </div>
                                {polygon.metrics?.stac_source && (
                                    <span className="text-xs font-mono text-emerald-400/80 bg-emerald-900/30 px-2 py-1 rounded">
                                        Source: {polygon.metrics.stac_source}
                                    </span>
                                )}
                            </div>

                            {/* Metrics Grid */}
                            <AnimatePresence>
                                {polygon.metrics && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2"
                                    >
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2 text-center text-balance">
                                            <Leaf className="w-6 h-6 text-emerald-400" />
                                            <span className="text-slate-400 text-xs">NDVI Mean</span>
                                            {polygon.metrics.ndvi_mean !== null ? (
                                                <span className="text-2xl font-light text-white font-mono">{polygon.metrics.ndvi_mean}</span>
                                            ) : (
                                                <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                                    {polygon.metrics.ndvi_error || 'NO DATA'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                            <Thermometer className="w-6 h-6 text-orange-400" />
                                            <span className="text-slate-400 text-xs">Temperature</span>
                                            <span className="text-2xl font-light text-white font-mono">{polygon.metrics.weather?.temperature_2m}°C</span>
                                        </div>
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                            <Droplets className="w-6 h-6 text-blue-400" />
                                            <span className="text-slate-400 text-xs">Humidity</span>
                                            <span className="text-2xl font-light text-white font-mono">{polygon.metrics.weather?.relative_humidity_2m}%</span>
                                        </div>
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                            <CloudRain className="w-6 h-6 text-cyan-400" />
                                            <span className="text-slate-400 text-xs">Precipitation</span>
                                            <span className="text-2xl font-light text-white font-mono">{polygon.metrics.weather?.precipitation}mm</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {polygon.gee_error && (
                                <div className="text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/50 text-sm mt-2">
                                    Failed to link: {polygon.gee_error}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

"use client";

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const DynamicMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[550px] border border-white/10 rounded-2xl flex items-center justify-center bg-slate-900/50 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-emerald-400 font-mono text-sm uppercase tracking-widest animate-pulse">Initializing Spatial Subsystem</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 md:p-12 bg-[#050505] text-white relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-6xl flex flex-col gap-10 z-10">

        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center justify-between border-b border-white/10 pb-6"
        >
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-500 tracking-tighter">
              CANOPY <span className="font-light text-slate-500">v2.0</span>
            </h1>
            <p className="text-emerald-500/70 font-mono text-sm mt-2 tracking-widest uppercase">
              Satellite-Calibrated IoT Vegetation Monitoring
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md shadow-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-xs font-mono text-slate-300">SYSTEM ONLINE</span>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold font-mono tracking-tight text-white">Target Selection</h2>
            <div className="h-px bg-gradient-to-r from-emerald-500/50 to-transparent flex-1" />
          </div>
          <DynamicMap />
        </motion.section>

      </div>
    </main>
  );
}

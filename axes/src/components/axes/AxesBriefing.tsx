import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAxesStore } from '../../store/useAxesStore';
import {
    Ruler, Navigation, Map as MapIcon,
    Target, Users, Zap, Check,
    Building2, Loader2, AlertCircle, RotateCcw,
    FolderOpen
} from 'lucide-react';
import { SavedPlansModal } from './SavedPlansModal';

const QUICK_PRESETS = [
    {
        id: 'villa',
        label: 'Modern Villa',
        icon: '🏡',
        description: 'Majlis + 5 rooms',
        targetArea: 450,
        rooms: ['living', 'majlis', 'bedroom', 'kitchen', 'dining'],
        lotWidth: 20,
        lotDepth: 30,
    },
    {
        id: 'apartment',
        label: 'Luxury Apartment',
        icon: '🏢',
        description: 'Compact urban',
        targetArea: 180,
        rooms: ['living', 'bedroom', 'kitchen', 'study'],
        lotWidth: 15,
        lotDepth: 20,
    },
    {
        id: 'duplex',
        label: 'Urban Duplex',
        icon: '🏘️',
        description: 'Multi-floor',
        targetArea: 320,
        rooms: ['living', 'majlis', 'bedroom', 'kitchen', 'dining'],
        lotWidth: 18,
        lotDepth: 25,
    },
    {
        id: 'ground',
        label: 'Ground Floor +',
        icon: '🏪',
        description: 'Commercial base',
        targetArea: 280,
        rooms: ['shop', 'storage', 'office', 'bathroom'],
        lotWidth: 20,
        lotDepth: 25,
    },
];

const ROOM_OPTIONS = [
    { id: 'living', label: 'Living', icon: '🛋️' },
    { id: 'majlis', label: 'Majlis', icon: '👨‍👩‍👧‍👦' },
    { id: 'bedroom', label: 'Bedroom', icon: '🛏️' },
    { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
    { id: 'bathroom', label: 'Bathroom', icon: '🚿' },
    { id: 'dining', label: 'Dining', icon: '🍽️' },
    { id: 'study', label: 'Study', icon: '📚' },
    { id: 'garage', label: 'Garage', icon: '🚗' },
    { id: 'storage', label: 'Storage', icon: '📦' },
    { id: 'office', label: 'Office', icon: '💼' },
    { id: 'shop', label: 'Shop', icon: '🏪' },
];

const AxesBriefing: React.FC = () => {
    const { siteParams, setSiteParams, briefingRoom, setBriefingRoom, setActiveLayout,
        isSearching, setIsSearching, searchError, setSearchError, matchFound, setMatchFound
    } = useAxesStore();

    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [showSavedPlans, setShowSavedPlans] = useState(false);

    // --- Derived Balady calculations ---
    const frontSetback = Math.min(6, Math.max(3, siteParams.streetWidth / 5));
    const sideSetback = siteParams.isGroundFloor ? 0 : 2;
    const rearSetback = siteParams.isGroundFloor ? 0 : 2;
    const buildableWidth = siteParams.lotWidth - (2 * sideSetback);
    const buildableDepth = siteParams.lotDepth - frontSetback - rearSetback;
    const buildableArea = buildableWidth * buildableDepth;

    // --- Handlers ---
    const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
        setActivePreset(preset.id);
        setBriefingRoom({
            targetArea: preset.targetArea,
            selectedRoomTypes: preset.rooms,
            quickPreset: preset.id,
        });
        setSiteParams({ lotWidth: preset.lotWidth, lotDepth: preset.lotDepth });
        setMatchFound(false);
        setSearchError(null);
    };

    const toggleRoom = (roomId: string) => {
        setActivePreset(null);
        const current = briefingRoom.selectedRoomTypes;
        setBriefingRoom({
            selectedRoomTypes: current.includes(roomId)
                ? current.filter(r => r !== roomId)
                : [...current, roomId],
        });
        setMatchFound(false);
        setSearchError(null);
    };

    const handleReset = () => {
        setBriefingRoom({ targetArea: 300, selectedRoomTypes: [], quickPreset: null });
        setSiteParams({ lotWidth: 20, lotDepth: 30, streetWidth: 15, frontSide: 'north', isGroundFloor: true });
        setActivePreset(null);
        setMatchFound(false);
        setSearchError(null);
    };

    const findLayout = useCallback(async () => {
        setIsSearching(true);
        setSearchError(null);
        setMatchFound(false);

        try {
            // First, try with floor_plan_geojson column
            const getBaseQuery = () => supabase
                .from('resplan_layouts')
                .select('id, total_area_m2, width_m, height_m, nodes, links, rooms, room_types')
                // Envelope constraint — footprint must fit within buildable area
                .or(
                    `and(width_m.lte.${buildableWidth.toFixed(2)},height_m.lte.${buildableDepth.toFixed(2)}),` +
                    `and(width_m.lte.${buildableDepth.toFixed(2)},height_m.lte.${buildableWidth.toFixed(2)})`
                );

            const target = activePreset ? briefingRoom.targetArea : buildableArea * 0.8;

            console.log('[AxesBriefing] Searching for layouts. Target area:', target, 'Buildable:', buildableWidth, 'x', buildableDepth);

            // Fetch closest matches above and below target area
            const [aboveReq, belowReq] = await Promise.all([
                getBaseQuery().gte('total_area_m2', target).order('total_area_m2', { ascending: true }).limit(5),
                getBaseQuery().lt('total_area_m2', target).order('total_area_m2', { ascending: false }).limit(5)
            ]);

            console.log('[AxesBriefing] Query results:', {
                above: aboveReq.data?.length || 0,
                below: belowReq.data?.length || 0,
                aboveError: aboveReq.error,
                belowError: belowReq.error
            });

            if (aboveReq.error) throw new Error(aboveReq.error.message);
            if (belowReq.error) throw new Error(belowReq.error.message);

            const candidates = [...(aboveReq.data || []), ...(belowReq.data || [])];

            console.log('[AxesBriefing] Total candidates:', candidates.length);

            if (candidates.length === 0) {
                setSearchError('No layouts fit these site dimensions. Try a larger lot or smaller setback.');
                return;
            }

            // Find the absolute closest to target area
            const bestLayout = candidates.reduce((a, b) =>
                Math.abs((a.total_area_m2 ?? 0) - target) < Math.abs((b.total_area_m2 ?? 0) - target) ? a : b
            );

            console.log('[AxesBriefing] Found best layout:', bestLayout.id, 'Area:', bestLayout.total_area_m2);
            setActiveLayout(bestLayout);
            setMatchFound(true);
        } catch (err: any) {
            console.error('[AxesBriefing] Error:', err);
            setSearchError(err.message || 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePreset, briefingRoom.targetArea, buildableArea, buildableWidth, buildableDepth]);

    // Listen for the header button's custom event
    useEffect(() => {
        const handler = () => findLayout();
        window.addEventListener('axes:findLayout', handler);
        return () => window.removeEventListener('axes:findLayout', handler);
    }, [findLayout]);

    return (
        <div className="flex flex-col gap-0">

            <div className="flex divide-x divide-white/5">
                {/* ── Left Column: Site (Balady) ──────────────────── */}
                <div className="w-[280px] shrink-0 px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MapIcon size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                Site Constraints
                            </span>
                        </div>
                        {/* Live envelope badge */}
                        <div className="flex items-center gap-2 bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-2 py-1">
                            <span className="text-[9px] font-mono font-bold text-indigo-400">
                                {buildableWidth.toFixed(1)}×{buildableDepth.toFixed(1)}m
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Lot Width */}
                        <div className="space-y-1.5 flex items-center justify-between">
                            <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold shrink-0 w-24">
                                Lot Width (m)
                            </label>
                            <div className="relative w-32">
                                <Ruler size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                                <input
                                    type="number"
                                    value={siteParams.lotWidth}
                                    onChange={e => { setSiteParams({ lotWidth: Number(e.target.value) }); setActivePreset(null); }}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-7 pr-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium text-white"
                                />
                            </div>
                        </div>

                        {/* Lot Depth */}
                        <div className="space-y-1.5 flex items-center justify-between">
                            <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold shrink-0 w-24">
                                Lot Depth (m)
                            </label>
                            <div className="relative w-32">
                                <Ruler size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 rotate-90" />
                                <input
                                    type="number"
                                    value={siteParams.lotDepth}
                                    onChange={e => { setSiteParams({ lotDepth: Number(e.target.value) }); setActivePreset(null); }}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-7 pr-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium text-white"
                                />
                            </div>
                        </div>

                        {/* Street Width */}
                        <div className="space-y-1.5 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold shrink-0 w-24">
                                    Street (m)
                                </label>
                                <div className="relative w-32">
                                    <Navigation size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                                    <input
                                        type="number"
                                        value={siteParams.streetWidth}
                                        onChange={e => setSiteParams({ streetWidth: Number(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-7 pr-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium text-white"
                                    />
                                </div>
                            </div>
                            <span className="text-[9px] text-zinc-700 italic text-right w-full pr-1">↳ {frontSetback.toFixed(1)}m setback</span>
                        </div>

                        {/* Street Front */}
                        <div className="space-y-1.5 flex items-center justify-between mt-2 pt-3 border-t border-white/5">
                            <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold shrink-0 w-16">
                                Front
                            </label>
                            <div className="flex gap-1">
                                {(['north', 'south', 'east', 'west'] as const).map(side => (
                                    <button
                                        key={side}
                                        onClick={() => setSiteParams({ frontSide: side })}
                                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${siteParams.frontSide === side
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                                            : 'bg-black/40 border-white/5 text-zinc-600 hover:text-zinc-300'
                                            }`}
                                    >
                                        {side[0].toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Floor type toggle */}
                        <div className="space-y-1.5 flex items-center justify-between">
                            <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold shrink-0 w-16">Floor</label>
                            <div className="flex bg-black/40 border border-white/5 rounded-xl overflow-hidden w-[115px]">
                                <button
                                    onClick={() => setSiteParams({ isGroundFloor: true })}
                                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-all ${siteParams.isGroundFloor ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    GF
                                </button>
                                <button
                                    onClick={() => setSiteParams({ isGroundFloor: false })}
                                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-all border-l border-white/5 ${!siteParams.isGroundFloor ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    UF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Presets & CTA ───────────────────── */}
                <div className="flex-1 flex flex-col">
                    <div className="px-6 py-5 flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={13} className="text-amber-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Quick Presets</span>
                        </div>
                        {/* More narrow auto-fill grid for presets */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {QUICK_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => applyPreset(preset)}
                                    className={`relative p-2.5 rounded-xl border text-left transition-all flex flex-col items-start ${activePreset === preset.id
                                        ? 'border-indigo-500/60 bg-indigo-500/10'
                                        : 'border-white/5 bg-black/30 hover:border-white/10 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-center justify-between w-full mb-1">
                                        <span className="text-base">{preset.icon}</span>
                                        {activePreset === preset.id && (
                                            <Check size={10} className="text-indigo-400" />
                                        )}
                                    </div>
                                    <div className="text-[10px] font-bold text-white leading-tight truncate w-full">{preset.label}</div>
                                    <div className="text-[9px] text-zinc-600 mt-0.5 line-clamp-1">{preset.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="px-6 pb-5 flex gap-3">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('axes:findLayout'))}
                            disabled={isSearching}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-indigo-900/30"
                        >
                            {isSearching ? (
                                <><Loader2 size={16} className="animate-spin" /> Finding...</>
                            ) : (
                                <><Building2 size={16} /> Find My Layout</>
                            )}
                        </button>

                        <button
                            onClick={() => setShowSavedPlans(true)}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold transition-all border border-zinc-700"
                        >
                            <FolderOpen size={16} />
                            My Plans
                        </button>
                    </div>
                </div>
            </div>

            {/* Saved Plans Modal */}
            <SavedPlansModal isOpen={showSavedPlans} onClose={() => setShowSavedPlans(false)} />
        </div>
    );
};

export default AxesBriefing;

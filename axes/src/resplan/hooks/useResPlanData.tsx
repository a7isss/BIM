import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

import type { ResPlanData, ResPlanContextType, Opening, Level } from '../types';

const ResPlanContext = createContext<ResPlanContextType | null>(null);

// Module-level reference so external code (e.g. Zustand store, App.tsx) can push data in
let externalSetData: ((data: ResPlanData) => void) | null = null;
/** Call this from outside the provider tree to load ResPlan data (replaces fetch on mount) */
export function loadExternalResPlanData(data: ResPlanData) {
    externalSetData?.(data);
}

export const ResPlanProvider: React.FC<{children: React.ReactNode; projectId?: string}> = ({ children, projectId: propProjectId }) => {
    const [past, setPast] = useState<ResPlanData[]>([]);
    const [present, setPresent] = useState<ResPlanData | null>(null);
    const [future, setFuture] = useState<ResPlanData[]>([]);
    const [bom, setBom] = useState<any[]>([]);
    const [structuralReport, setStructuralReport] = useState<any>(null);
    const [projectId, setProjectId] = useState<string>(propProjectId || 'Sample Project');

    // Expose setPresent via module-level ref so external code can inject data
    const internalSetData = useCallback((data: ResPlanData) => {
        setPast([]);
        setFuture([]);
        setPresent(data);
        setBom([]);
        setStructuralReport(null);
    }, []);
    useEffect(() => {
        externalSetData = internalSetData;
        return () => { externalSetData = null; };
    }, [internalSetData]);

    useEffect(() => {
        // Only auto-fetch if no external data has been loaded yet
        if (present) return;
        fetch(`/api/load_project?id=${encodeURIComponent(projectId)}`)
            .then(res => res.json())
            .then((payload) => {
                const data = payload.nodes_data || {};
                const typesData = payload.arch_types_data || { doors: [], windows: [] };
                const structTypesData = payload.struct_types_data || { columns: [], beams: [] };
                const settingsData = payload.settings_data || { floor_height_m: 3.0, parapet_height_m: 1.0 };
                const structReport = payload.structural_report_data || null;
                
                if (structReport) {
                    setStructuralReport(structReport);
                    if (structReport.elements) setBom(structReport.elements);
                }
            setPresent({
                nodes: data.default?.nodes || data.nodes || [],
                elements: data.default?.elements || data.elements || [],
                slabs: data.default?.slabs || data.slabs || [],
                architecture: data.default?.architecture || data.architecture || [],
                rooms: data.default?.rooms || data.rooms || [],
                openings: (data.default?.openings || data.openings || []).map((op: Opening) => {
                    if (op.z !== undefined && op.height !== undefined) return op;
                    const isWindow = op.type === 'window';
                    const lvl = (data.default?.levels?.architectural || data.levels?.architectural || []).find((l: Level) => l.id === op.level_id);
                    const lvl_z = lvl ? lvl.elevation_m : 0;
                    
                    const defaultHeight = isWindow ? 1.2 : 2.1;
                    const defaultSill = isWindow ? 1.0 : 0.0;
                    
                    return {
                        ...op,
                        height: op.height !== undefined ? op.height : defaultHeight,
                        z: op.z !== undefined ? op.z : (lvl_z + defaultSill)
                    };
                }),
                levels: data.default?.levels || data.levels || { architectural: [], structural: [] },
                touchups: payload.touchups_data?.touchups || [],
                annotations: payload.annotations || [],
                types: {
                    ...((typesData as any).default || typesData),
                    ...((structTypesData as any).default || structTypesData)
                },
                project_info: {
                    ...(data.default?.project_info || data.project_info || { name: 'New Project', front_elevation_angle: 0 }),
                    plot: payload.project?.plot
                },
                settings: (settingsData as any).default || settingsData
            });
        }).catch(err => console.error("Failed to load resplan project:", err));
    }, [present]);

    const reloadResults = useCallback(async () => {
        try {
            const res = await fetch(`/api/load_project?id=${encodeURIComponent(projectId)}`);
            if (res.ok) {
                const payload = await res.json();
                const structReport = payload.structural_report_data || null;
                if (structReport) {
                    setStructuralReport(structReport);
                    if (structReport.elements) setBom(structReport.elements);
                    console.log('Results reloaded successfully');
                }
            }
        } catch (e) {
            console.error('Failed to reload results', e);
        }
    }, []);

    const updateState = useCallback((newState: Partial<ResPlanData>) => {
        if (!present) return;
        setPast(prev => [...prev, present]);
        setPresent({ ...present, ...newState });
        setFuture([]); // clear future on new action
    }, [present]);

    const undo = useCallback(() => {
        if (past.length === 0 || !present) return;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        setPast(newPast);
        setFuture(prev => [present, ...prev]);
        setPresent(previous);
    }, [past, present]);

    const redo = useCallback(() => {
        if (future.length === 0 || !present) return;
        const next = future[0];
        const newFuture = future.slice(1);
        setPast(prev => [...prev, present]);
        setPresent(next);
        setFuture(newFuture);
    }, [future, present]);

    const save = useCallback(async () => {
        if (!present) return;
        try {
            const response = await fetch(`/api/save?id=${encodeURIComponent(projectId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(present)
            });
            const result = await response.json();
            if (result.success) {
                console.log('Saved successfully');
            } else {
                console.error('Failed to save', result.error);
            }
        } catch (e) {
            console.error('Save request failed', e);
        }
    }, [present, projectId]);

    const saveTypes = useCallback(async () => {
        if (!present) return;
        try {
            const response = await fetch(`/api/save_types?id=${encodeURIComponent(projectId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(present.types)
            });
            const result = await response.json();
            if (result.success) {
                console.log('Types saved successfully');
            } else {
                console.error('Failed to save types', result.error);
            }
        } catch (e) {
            console.error('Save types request failed', e);
        }
    }, [present, projectId]);

    const saveTouchups = useCallback(async () => {
        if (!present) return;
        try {
            const response = await fetch(`/api/save_touchups?id=${encodeURIComponent(projectId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ touchups: present.touchups })
            });
            const result = await response.json();
            if (result.success) {
                console.log('Touchups saved successfully');
            } else {
                console.error('Failed to save touchups', result.error);
            }
        } catch (e) {
            console.error('Save touchups request failed', e);
        }
    }, [present, projectId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const value = {
        ...(present || {
            nodes: [], elements: [], slabs: [], architecture: [], rooms: [], openings: [], levels: { architectural: [], structural: [] }, touchups: [], annotations: [], types: { doors: [], windows: [] }, settings: { floor_height_m: 3.5, parapet_height_m: 1.0 }
        }),
        bom,
        structuralReport,
        projectId,
        setProjectId,
        updateState,
        undo,
        redo,
        save,
        saveTypes,
        saveTouchups,
        reloadResults,
        canUndo: past.length > 0,
        canRedo: future.length > 0
    };

    return (
        <ResPlanContext.Provider value={value}>
            {children}
        </ResPlanContext.Provider>
    );
};

export const useResPlanData = () => {
    const context = useContext(ResPlanContext);
    if (!context) {
        throw new Error('useResPlanData must be used within a ResPlanProvider');
    }
    return context;
};

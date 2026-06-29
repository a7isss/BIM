import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface ResPlanData {
    nodes: any[];
    elements: any[];
    slabs: any[];
    architecture: any[];
    rooms: any[];
    openings: any[];
    levels: any;
    types: any;
    project_info?: { name?: string; designer?: string; client?: string; date?: string; rev?: string; front_elevation_angle?: number };
    settings?: any;
}

const ResPlanContext = createContext<any>(null);

export const ResPlanProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [past, setPast] = useState<ResPlanData[]>([]);
    const [present, setPresent] = useState<ResPlanData | null>(null);
    const [future, setFuture] = useState<ResPlanData[]>([]);
    const [bom, setBom] = useState<any[]>([]);
    const [structuralReport, setStructuralReport] = useState<any>(null);

    useEffect(() => {
        // Fetch base nodes
        fetch('/api/load_project')
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
            setPresent(prev => prev ? prev : {
                nodes: data.default?.nodes || data.nodes || [],
                elements: data.default?.elements || data.elements || [],
                slabs: data.default?.slabs || data.slabs || [],
                architecture: data.default?.architecture || data.architecture || [],
                rooms: data.default?.rooms || data.rooms || [],
                openings: (data.default?.openings || data.openings || []).map((op: any) => {
                    if (op.z !== undefined && op.height !== undefined) return op;
                    const isWindow = op.type === 'window';
                    const lvl = (data.default?.levels?.architectural || data.levels?.architectural || []).find((l: any) => l.id === op.level_id);
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
                types: {
                    ...((typesData as any).default || typesData),
                    ...((structTypesData as any).default || structTypesData)
                },
                project_info: data.default?.project_info || data.project_info || { name: 'New Project', front_elevation_angle: 0 },
                settings: (settingsData as any).default || settingsData
            });
        }).catch(err => console.error("Failed to load resplan project:", err));
            
    }, []);

    const reloadResults = useCallback(async () => {
        try {
            const res = await fetch('/api/load_project');
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
            const response = await fetch('/api/save', {
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
    }, [present]);

    const saveTypes = useCallback(async () => {
        if (!present) return;
        try {
            const response = await fetch('/api/save_types', {
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
    }, [present]);

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
            nodes: [], elements: [], slabs: [], architecture: [], rooms: [], openings: [], levels: { architectural: [], structural: [] }, types: { doors: [], windows: [] }, settings: { floor_height_m: 3.5, parapet_height_m: 1.0 }
        }),
        bom,
        structuralReport,
        updateState,
        undo,
        redo,
        save,
        saveTypes,
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
        console.warn('useResPlanData must be used within a ResPlanProvider');
        return {
            nodes: [], elements: [], slabs: [], architecture: [], rooms: [], openings: [], levels: { architectural: [], structural: [] }, types: { doors: [], windows: [] }, settings: { floor_height_m: 3.5, parapet_height_m: 1.0 },
            updateState: () => {}, undo: () => {}, redo: () => {}, save: async () => {}, saveTypes: async () => {}, reloadResults: async () => {}
        };
    }
    return context;
};

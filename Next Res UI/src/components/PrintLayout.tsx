import React from 'react';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Scope } from './RightPanel';
import LayoutCanvas from './LayoutCanvas';

interface PrintLayoutProps {
    scope: Scope;
}

const PrintLayout: React.FC<PrintLayoutProps> = ({ scope }) => {
    const { slabs, levels, project_info, structuralReport } = useResPlanData();

    // Extract schedules from the backend-generated report
    const columns = structuralReport?.schedules?.columns || [];
    const beams = structuralReport?.schedules?.beams || [];
    const footings = structuralReport?.schedules?.footings || [];
    const groundBeams = structuralReport?.schedules?.groundBeams || [];
    
    const renderTable = (title: string, items: any[], isFooting = false) => (
        <section className="flex-1 min-w-[45%]">
            <h2 className="text-2xl font-bold border-b-2 border-gray-800 pb-2 mb-4 text-black bg-gray-200 px-4 py-2">{title}</h2>
            <table className="w-full text-left border-collapse text-sm">
                <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-800 text-black">
                        <th className="py-3 px-4 border border-gray-400">Mark</th>
                        <th className="py-3 px-4 border border-gray-400">{isFooting ? 'Dimensions (L×W×D)' : 'Section (b×h)'}</th>
                        <th className="py-3 px-4 border border-gray-400">Reinforcement</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-300">
                            <td className="py-3 px-4 border border-gray-400 font-mono text-black font-bold">{item.design_label || item.mark}</td>
                            <td className="py-3 px-4 border border-gray-400 font-mono text-gray-800 font-bold">{item.section || item.dimensions}</td>
                            <td className="py-3 px-4 border border-gray-400 font-mono text-gray-600">{item.reinforcement}</td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={3} className="py-6 text-center text-gray-500 italic border border-gray-400">No {title.toLowerCase()} found in report.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    );

    const availableLevels = scope === 'structural' ? (levels?.structural || []) : (levels?.architectural || []);

    return (
        <div className="hidden print:block text-black bg-white w-full font-sans">
            <style>
                {`
                @page {
                    size: A3 landscape;
                    margin: 0;
                }
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                `}
            </style>
            
            {/* 1. Floor Plan Layouts */}
            {availableLevels.map((level: any, index: number) => (
                <div key={level.id} className="w-[420mm] h-[297mm] mx-auto page-break break-after-page relative overflow-hidden flex bg-white" style={{ pageBreakAfter: 'always' }}>
                    
                    {/* The Canvas Area (Left 80%) */}
                    <div className="w-[85%] h-full border-r-4 border-black relative">
                        <LayoutCanvas 
                            scope={scope} 
                            isEditMode={false} 
                            setIsEditMode={() => {}} 
                            forcedFloor={level.id} 
                            isPrintMode={true} 
                        />
                    </div>
                    
                    {/* The Title Block / Legend (Right 15%) */}
                    <div className="w-[15%] h-full flex flex-col border-l-4 border-black bg-white">
                        
                        {/* Project Info Section */}
                        <div className="border-b-4 border-black p-4 flex-1">
                            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-black pb-2 text-center">Project Info</h2>
                            <div className="space-y-4 text-sm font-semibold">
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Project</span>
                                    <p className="text-lg leading-tight uppercase">{project_info?.name || 'Untitled Project'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Client</span>
                                    <p className="uppercase">{project_info?.client || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Designer</span>
                                    <p className="uppercase">{project_info?.designer || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Drawing Info Section */}
                        <div className="border-b-4 border-black p-4 flex-1">
                            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-black pb-2 text-center">Drawing Info</h2>
                            <div className="space-y-4 text-sm font-semibold">
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Floor Level</span>
                                    <p className="text-lg leading-tight uppercase">{level.name}</p>
                                    <p className="text-gray-500 mt-1">El: {level.elevation_m > 0 ? '+' : ''}{level.elevation_m.toFixed(2)}m</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Plan Type</span>
                                    <p className="uppercase">{scope} Layout</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Date</span>
                                    <p>{project_info?.date || new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-4">
                                    <span className="text-xs text-gray-500 uppercase tracking-widest block">Rev</span>
                                    <p className="text-lg">{project_info?.rev || '00'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Document Number / Sheet Section */}
                        <div className="p-4 flex flex-col justify-center items-center bg-gray-100">
                            <span className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Sheet Number</span>
                            <h1 className="text-4xl font-bold font-mono tracking-tighter">
                                {scope.substring(0,1).toUpperCase()}-{String(index + 1).padStart(2, '0')}
                            </h1>
                        </div>
                    </div>
                </div>
            ))}

            {/* 2. Structural Schedules (Only if Structural Scope) */}
            {scope === 'structural' && (
                <div className="w-[420mm] h-[297mm] mx-auto page-break break-after-page relative bg-white border-8 border-black p-12 flex flex-col" style={{ pageBreakAfter: 'always' }}>
                    
                    <header className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-widest text-black">Structural Schedules</h1>
                            <p className="text-gray-600 font-bold text-2xl mt-2">Project: {project_info?.name || 'Untitled'}</p>
                        </div>
                        <div className="text-right text-gray-600 font-bold font-mono text-xl">
                            <p>Date: {project_info?.date || new Date().toLocaleDateString()}</p>
                            <p>Sheet: S-SCHED</p>
                        </div>
                    </header>

                    <div className="flex gap-12 flex-1 overflow-hidden flex-wrap">
                        {renderTable("Column Schedule", columns)}
                        {renderTable("Beam Schedule", beams)}
                        {renderTable("Footing Schedule", footings, true)}
                        {renderTable("Ground Beam Schedule", groundBeams)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrintLayout;

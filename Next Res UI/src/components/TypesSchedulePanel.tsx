import React, { useState } from 'react';
import { useResPlanData } from '../hooks/useResPlanData';
import { X, Plus, Save } from 'lucide-react';

interface TypesSchedulePanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const TypesSchedulePanel: React.FC<TypesSchedulePanelProps> = ({ isOpen, setIsOpen }) => {
    const { types, updateState, saveTypes } = useResPlanData();
    const [activeTab, setActiveTab] = useState<'doors' | 'windows'>('doors');

    if (!isOpen) return null;

    const handleTypeChange = (index: number, field: string, value: string | number) => {
        const newTypes = { ...types };
        newTypes[activeTab] = [...newTypes[activeTab]];
        newTypes[activeTab][index] = { ...newTypes[activeTab][index], [field]: value };
        updateState({ types: newTypes });
    };

    const handleAddType = () => {
        const newTypes = { ...types };
        const idPrefix = activeTab === 'doors' ? 'D' : 'W';
        const newId = `${idPrefix}${newTypes[activeTab].length + 1}`;
        
        if (activeTab === 'doors') {
            newTypes.doors.push({ id: newId, name: 'New Door Type', width: 1.0, height: 2.1 });
        } else {
            newTypes.windows.push({ id: newId, name: 'New Window Type', width: 1.0, height: 1.2, sill_height: 1.0 });
        }
        updateState({ types: newTypes });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 w-[800px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                    <h2 className="text-lg font-semibold text-zinc-100">Family Types Schedule</h2>
                    <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 gap-4 border-b border-zinc-800 bg-zinc-900">
                    <button 
                        onClick={() => setActiveTab('doors')}
                        className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'doors' ? 'border-amber-500 text-amber-500' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                    >
                        Doors Schedule
                    </button>
                    <button 
                        onClick={() => setActiveTab('windows')}
                        className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'windows' ? 'border-amber-500 text-amber-500' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                    >
                        Windows Schedule
                    </button>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto p-6 bg-zinc-950 custom-scrollbar">
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="text-xs uppercase bg-zinc-800 text-zinc-300">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Type ID</th>
                                <th className="px-4 py-3">Family Name</th>
                                <th className="px-4 py-3">Width (m)</th>
                                <th className="px-4 py-3">Height (m)</th>
                                {activeTab === 'windows' && <th className="px-4 py-3">Sill Height (m)</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(types[activeTab] || []).map((item: { id: string, name: string, width: number, height: number, sill_height?: number }, idx: number) => (
                                <tr key={item.id} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white">{item.id}</td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="text" 
                                            value={item.name} 
                                            onChange={(e) => handleTypeChange(idx, 'name', e.target.value)}
                                            className="bg-transparent border border-transparent hover:border-zinc-700 focus:border-amber-500 rounded px-2 py-1 w-full outline-none text-zinc-200 transition-colors"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="number" 
                                            step="0.05"
                                            value={item.width} 
                                            onChange={(e) => handleTypeChange(idx, 'width', parseFloat(e.target.value))}
                                            className="bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded px-2 py-1 w-20 outline-none text-zinc-200 transition-colors"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="number" 
                                            step="0.05"
                                            value={item.height} 
                                            onChange={(e) => handleTypeChange(idx, 'height', parseFloat(e.target.value))}
                                            className="bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded px-2 py-1 w-20 outline-none text-zinc-200 transition-colors"
                                        />
                                    </td>
                                    {activeTab === 'windows' && (
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number" 
                                                step="0.05"
                                                value={item.sill_height} 
                                                onChange={(e) => handleTypeChange(idx, 'sill_height', parseFloat(e.target.value))}
                                                className="bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded px-2 py-1 w-20 outline-none text-zinc-200 transition-colors"
                                            />
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    <button 
                        onClick={handleAddType}
                        className="mt-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-500 transition-colors px-2 py-1"
                    >
                        <Plus size={16} /> Add New Type
                    </button>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => {
                            saveTypes();
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-lg shadow-amber-900/20 transition-all"
                    >
                        <Save size={16} /> Save Types
                    </button>
                </div>

            </div>
        </div>
    );
};

export default TypesSchedulePanel;

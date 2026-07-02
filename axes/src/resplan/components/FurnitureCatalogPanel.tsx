import React, { useEffect, useState } from 'react';
import { useResPlanData } from '../hooks/useResPlanData';

interface FurnitureCatalogPanelProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeFurniture: string;
    setActiveFurniture: (id: string) => void;
}

const FurnitureCatalogPanel: React.FC<FurnitureCatalogPanelProps> = ({ isOpen, setIsOpen, activeFurniture, setActiveFurniture }) => {
    const { types } = useResPlanData();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const furniture = types?.furniture || [];

    const categories = React.useMemo(() => {
        const cats = new Set<string>();
        furniture.forEach((f: any) => cats.add(f.category || 'Other'));
        return ['All', ...Array.from(cats)];
    }, [furniture]);

    if (!isOpen) return null;

    const filtered = selectedCategory === 'All' 
        ? furniture 
        : furniture.filter((f: any) => (f.category || 'Other') === selectedCategory);

    return (
        <div className="fixed bottom-32 right-6 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 flex flex-col max-h-[60vh] overflow-hidden text-sm">
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                <h3 className="font-semibold text-zinc-200">Furniture Catalog</h3>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div className="p-2 border-b border-zinc-800 flex gap-2 overflow-x-auto no-scrollbar">
                {categories.map(c => (
                    <button 
                        key={c}
                        onClick={() => setSelectedCategory(c)}
                        className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${selectedCategory === c ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            <div className="p-3 overflow-y-auto grid grid-cols-2 gap-2">
                {filtered.map((item: any) => (
                    <div 
                        key={item.id}
                        onClick={() => setActiveFurniture(item.id)}
                        className={`border rounded-lg p-2 cursor-pointer transition flex flex-col items-center gap-2 ${activeFurniture === item.id ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}
                    >
                        <div className="w-full aspect-square bg-white rounded-md flex items-center justify-center overflow-hidden p-1">
                            {item.svg_path ? (
                                <img src={`/${item.svg_path}`} alt={item.name} className="max-w-full max-h-full object-contain" />
                            ) : (
                                <span className="text-zinc-600 text-xs text-center">{item.name}</span>
                            )}
                        </div>
                        <span className="text-xs text-zinc-300 text-center leading-tight">{item.name}</span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-2 text-center text-zinc-500 py-4">No furniture found</div>
                )}
            </div>
        </div>
    );
};

export default FurnitureCatalogPanel;

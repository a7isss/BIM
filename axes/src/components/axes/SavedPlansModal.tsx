import React, { useEffect, useState } from 'react';
import { useAxesStore } from '../../store/useAxesStore';
import { X, LayoutGrid, Clock, Check } from 'lucide-react';

interface SavedPlan {
    id: string;
    plan_name: string;
    updated_at: string;
    total_area_m2?: number;
}

interface SavedPlansModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SavedPlansModal: React.FC<SavedPlansModalProps> = ({ isOpen, onClose }) => {
    const { loadPlan } = useAxesStore();
    const [plans, setPlans] = useState<SavedPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const resp = await fetch('/api/list-plans');
            if (resp.ok) {
                const data = await resp.json();
                setPlans(data.sort((a: any, b: any) =>
                    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                ));
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchPlans();
    }, [isOpen]);

    const handleLoadPlan = async (planId: string) => {
        setLoadingPlan(planId);
        try {
            await loadPlan(planId);
            onClose();
        } catch (err) {
            console.error('Error loading plan:', err);
            alert('Failed to load plan.');
        } finally {
            setLoadingPlan(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">Saved Projects</h2>
                        <p className="text-sm text-zinc-400 mt-1">Projects are stored as JSON files in the Projects/ directory</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                            <LayoutGrid size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No saved projects yet</p>
                            <p className="text-sm">Edit a plan and save it — the project files go into <code className="text-zinc-400 bg-zinc-800 px-1 rounded">/Projects/{'{id}'}/</code></p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {plans.map((plan) => {
                                const isLoading = loadingPlan === plan.id;
                                return (
                                    <div
                                        key={plan.id}
                                        onClick={() => !isLoading && handleLoadPlan(plan.id)}
                                        className={`group relative bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-200 flex flex-col ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isLoading && (
                                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                                                    <span className="text-xs text-white font-medium">Loading...</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="aspect-video bg-zinc-700 flex items-center justify-center relative border-b border-zinc-700/50">
                                            <LayoutGrid className="text-zinc-600" size={48} strokeWidth={1} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-800 via-transparent to-transparent opacity-60"></div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="font-semibold text-base text-white mb-3 truncate">
                                                {plan.plan_name || plan.id}
                                            </h3>
                                            <div className="flex flex-col gap-2 mt-auto shrink-0 text-xs text-zinc-400">
                                                <div className="flex items-center gap-2">
                                                    <LayoutGrid size={14} />
                                                    <span>{plan.total_area_m2 ? `${Math.round(plan.total_area_m2)}m²` : '?'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} />
                                                    <span>{plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : 'unknown'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isLoading && (
                                            <div className="absolute top-3 right-3">
                                                <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                                                    <Check size={14} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

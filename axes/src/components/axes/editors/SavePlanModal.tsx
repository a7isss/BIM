import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

interface SavePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (planName: string) => Promise<void>;
}

export const SavePlanModal: React.FC<SavePlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [planName, setPlanName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!planName.trim()) {
      setError('Please enter a plan name');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(planName.trim());
      setPlanName('');
      onClose();
    } catch (err) {
      setError('Failed to save plan. Please try again.');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Save size={20} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Save Plan Before Editing</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info message */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <AlertCircle size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-300 leading-relaxed">
              Please save your plan before editing. This ensures your changes are preserved and you can return to them later.
            </p>
          </div>

          {/* Plan name input */}
          <div className="space-y-2">
            <label htmlFor="planName" className="block text-sm font-medium text-zinc-300">
              Plan Name
            </label>
            <input
              id="planName"
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g., Modern Villa - First Floor"
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !planName.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save & Edit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

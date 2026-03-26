import React, { useState, useEffect } from 'react';
import { Key, Save, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySave: (key: string) => void;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({
  isOpen,
  onClose,
  onKeySave,
}) => {
  const [key, setKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    setKey(savedKey);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', key);
    onKeySave(key);
    onClose();
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setKey('');
    onKeySave('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              API Key Settings
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                Gemini API Key
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 text-xs font-normal"
                >
                  Get Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <div className="relative">
                <input
                  type={isVisible ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {isVisible ? <X className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Your API key is stored locally in your browser and never sent to our servers. 
                It is only used to communicate directly with Google's AI services.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Privacy First</h4>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    By using your own key, you get your own dedicated quota and keep your data private. 
                    Free keys have a limit of 15 requests per minute.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Clear Key
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

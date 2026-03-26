import React from 'react';
import { Download, MonitorPlay, FileText } from 'lucide-react';

interface ExportSettingsProps {
  resolution: string;
  onResolutionChange: (res: string) => void;
  onExport: () => void;
  onExportSRT: () => void;
  isExporting: boolean;
  progress: number;
}

export const ExportSettings: React.FC<ExportSettingsProps> = ({
  resolution,
  onResolutionChange,
  onExport,
  onExportSRT,
  isExporting,
  progress,
}) => {
  const resolutions = [
    { id: 'original', label: 'Original Quality' },
    { id: '1080p', label: '1080P (FHD)' },
    { id: '2k', label: '2K (QHD)' },
    { id: '4k', label: '4K (UHD)' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <MonitorPlay className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">Export Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700 block">Select Resolution</label>
          <div className="grid grid-cols-2 gap-3">
            {resolutions.map((res) => (
              <button
                key={res.id}
                onClick={() => onResolutionChange(res.id)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  resolution === res.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 italic mt-2">
            Tip: Lower resolutions (like 1080p) export significantly faster than 4K.
          </p>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700 block">Subtitle Export</label>
          <div className="space-y-3">
            <button
              onClick={onExportSRT}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium group"
            >
              <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              Download SRT File
            </button>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              SRT files are compatible with CapCut (剪映), Premiere Pro, and most video players.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4 space-y-4 border-t border-gray-100">
        {isExporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 font-medium">
              <span>Exporting Video...</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              ></div>
            </div>
          </div>
        )}
        <button
          onClick={onExport}
          disabled={isExporting}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all ${
            isExporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200'
          }`}
        >
          {isExporting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Generate & Download Video
            </>
          )}
        </button>
      </div>
    </div>
  );
};

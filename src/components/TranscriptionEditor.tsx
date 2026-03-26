import React, { useRef } from 'react';
import { SubtitleSegment } from '../lib/gemini';
import { Clock, Edit3, Play, ArrowRight, Timer, Upload, FileText } from 'lucide-react';
import { parseSRT } from '../lib/srt';

interface TranscriptionEditorProps {
  subtitles: SubtitleSegment[];
  onSubtitlesChange: (subtitles: SubtitleSegment[]) => void;
  title: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  allowImport?: boolean;
}

export const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  subtitles,
  onSubtitlesChange,
  title,
  currentTime = 0,
  onSeek,
  allowImport = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = React.useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleImportSRT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const parsed = parseSRT(content);
          if (parsed.length > 0) {
            onSubtitlesChange(parsed);
            setImportStatus({ type: 'success', message: `Successfully imported ${parsed.length} segments.` });
          } else {
            setImportStatus({ type: 'error', message: 'No valid subtitle segments found in the file.' });
          }
        } catch (err) {
          console.error('SRT Parse Error:', err);
          setImportStatus({ type: 'error', message: 'Failed to parse the SRT file. Please check the format.' });
        }
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read the file.' });
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Clear status after 3 seconds
    setTimeout(() => setImportStatus(null), 3000);
  };
  const handleTextChange = (index: number, newText: string) => {
    const newSubtitles = [...subtitles];
    newSubtitles[index] = { ...newSubtitles[index], text: newText };
    onSubtitlesChange(newSubtitles);
  };

  const handleTimeChange = (index: number, field: 'start' | 'end', value: string) => {
    // Basic validation for time input (mm:ss.ms)
    const newSubtitles = [...subtitles];
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      newSubtitles[index] = { ...newSubtitles[index], [field]: numValue };
      onSubtitlesChange(newSubtitles);
    }
  };

  const setTimeToCurrent = (index: number, field: 'start' | 'end') => {
    const newSubtitles = [...subtitles];
    newSubtitles[index] = { ...newSubtitles[index], [field]: parseFloat(currentTime.toFixed(2)) };
    onSubtitlesChange(newSubtitles);
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, 2);
    return `${mm}:${ss}.${ms}`;
  };

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (currentTime) {
      const activeIndex = subtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
      if (activeIndex !== -1 && scrollRef.current) {
        const activeElement = scrollRef.current.children[activeIndex] as HTMLElement;
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [currentTime, subtitles]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-gray-500" />
            {title}
          </h3>
          {allowImport && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".srt,.txt,text/plain"
                ref={fileInputRef}
                onChange={handleImportSRT}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                title="Import SRT file to overwrite original text"
              >
                <Upload className="w-3 h-3" />
                Import SRT
              </button>
              {importStatus && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-left-2 duration-300 shadow-sm ${
                  importStatus.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {importStatus.message}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-sm text-gray-500">{subtitles.length} segments</span>
      </div>
      <div ref={scrollRef} className="overflow-y-auto flex-1 p-4 space-y-3">
        {subtitles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No subtitles available yet.</div>
        ) : (
          subtitles.map((sub, index) => {
            const isActive = currentTime >= sub.start && currentTime <= sub.end;
            return (
              <div
                key={index}
                className={`group flex gap-4 p-3 rounded-lg border transition-all ${
                  isActive 
                    ? 'border-blue-200 bg-blue-50/50 ring-1 ring-blue-100' 
                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center justify-start pt-1 w-28 shrink-0 space-y-2">
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center gap-1 group/time">
                      <button 
                        onClick={() => onSeek?.(sub.start)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600 transition-colors"
                        title="Jump to start time"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sub.start}
                        onChange={(e) => handleTimeChange(index, 'start', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-xs font-mono text-gray-500 focus:ring-0 focus:text-blue-600"
                      />
                      <button 
                        onClick={() => setTimeToCurrent(index, 'start')}
                        className="opacity-0 group-hover/time:opacity-100 p-1 hover:bg-blue-100 rounded text-blue-500 transition-all"
                        title="Set to current video time"
                      >
                        <Timer className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 group/time">
                      <button 
                        onClick={() => onSeek?.(sub.end)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600 transition-colors"
                        title="Jump to end time"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sub.end}
                        onChange={(e) => handleTimeChange(index, 'end', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-xs font-mono text-gray-500 focus:ring-0 focus:text-blue-600"
                      />
                      <button 
                        onClick={() => setTimeToCurrent(index, 'end')}
                        className="opacity-0 group-hover/time:opacity-100 p-1 hover:bg-blue-100 rounded text-blue-500 transition-all"
                        title="Set to current video time"
                      >
                        <Timer className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      {(sub.end - sub.start).toFixed(2)}s
                    </div>
                    {index < subtitles.length - 1 && (
                      <button 
                        onClick={() => {
                          const newSubtitles = [...subtitles];
                          newSubtitles[index + 1] = { ...newSubtitles[index + 1], start: sub.end };
                          onSubtitlesChange(newSubtitles);
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500 transition-colors"
                        title="Sync next segment start to this end"
                      >
                        <ArrowRight className="w-3 h-3 rotate-90" />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={sub.text}
                  onChange={(e) => handleTextChange(index, e.target.value)}
                  className="flex-1 bg-transparent border-none resize-none focus:ring-0 p-0 text-gray-700 text-sm min-h-[40px] leading-relaxed"
                  rows={2}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

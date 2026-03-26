import React from 'react';
import { SubtitleStyle } from '../lib/ffmpeg';
import { Settings2, Type, Move, Palette, Play } from 'lucide-react';

interface SubtitleStylerProps {
  style: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
  onPreview?: () => void;
}

export const SubtitleStyler: React.FC<SubtitleStylerProps> = ({ style, onStyleChange, onPreview }) => {
  const handleChange = (key: keyof SubtitleStyle, value: any) => {
    onStyleChange({ ...style, [key]: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Subtitle Styling</h3>
        </div>
        {onPreview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Preview on Video
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Type className="w-4 h-4 text-gray-400" />
              Font Size
            </label>
            <span className="text-sm text-gray-500">{style.fontSize}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="72"
            value={style.fontSize}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              Color
            </label>
            <span className="text-sm text-gray-500 uppercase">{style.color}</span>
          </div>
          <input
            type="color"
            value={style.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-full h-10 rounded-lg cursor-pointer border-0 p-0"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Move className="w-4 h-4 text-gray-400" />
              Position X (%)
            </label>
            <span className="text-sm text-gray-500">{style.x}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={style.x}
            onChange={(e) => handleChange('x', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Move className="w-4 h-4 text-gray-400" />
              Position Y (%)
            </label>
            <span className="text-sm text-gray-500">{style.y}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={style.y}
            onChange={(e) => handleChange('y', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import { UploadCloud, FileVideo, FileText } from 'lucide-react';

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
  onSrtSelect: (file: File) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelect, onSrtSelect }) => {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      onVideoSelect(file);
    } else if (file) {
      alert('Please select a valid video file.');
    }
  };

  const handleSrtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSrtSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        onVideoSelect(file);
      } else if (file.name.endsWith('.srt')) {
        onSrtSelect(file);
      } else {
        alert('Please drop a valid video or SRT file.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer group"
        onClick={() => videoInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={videoInputRef}
          className="hidden"
          accept="video/*"
          onChange={handleVideoChange}
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="bg-blue-100 p-4 rounded-full group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upload Video</h3>
            <p className="text-sm text-gray-500 mt-1">Click or drag and drop your video file here</p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <FileVideo className="w-4 h-4" />
            <span>MP4, WebM, MOV up to 1GB</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-50 text-gray-500">OR</span>
        </div>
      </div>

      <div 
        className="bg-white border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-between group"
        onClick={() => srtInputRef.current?.click()}
      >
        <input
          type="file"
          ref={srtInputRef}
          className="hidden"
          accept=".srt"
          onChange={handleSrtChange}
        />
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition-colors">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-gray-900">Translate SRT Only</h4>
            <p className="text-xs text-gray-500 mt-0.5">Import an existing SRT file to translate without a video</p>
          </div>
        </div>
        <div className="text-indigo-600 text-xs font-bold px-3 py-1 bg-indigo-50 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-all">
          Import SRT
        </div>
      </div>
    </div>
  );
};

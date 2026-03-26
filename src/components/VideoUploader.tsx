import React, { useRef } from 'react';
import { UploadCloud, FileVideo } from 'lucide-react';

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      onVideoSelect(file);
    } else {
      alert('Please select a valid video file.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      onVideoSelect(file);
    } else {
      alert('Please drop a valid video file.');
    }
  };

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="video/*"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="bg-blue-100 p-4 rounded-full">
          <UploadCloud className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Upload Video</h3>
          <p className="text-sm text-gray-500 mt-1">Click or drag and drop your video file here</p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <FileVideo className="w-4 h-4" />
          <span>MP4, WebM, MOV up to 500MB</span>
        </div>
      </div>
    </div>
  );
};

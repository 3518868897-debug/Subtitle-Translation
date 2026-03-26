/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { TranscriptionEditor } from './components/TranscriptionEditor';
import { SubtitleStyler } from './components/SubtitleStyler';
import { ExportSettings } from './components/ExportSettings';
import { extractAudio, exportVideo, SubtitleStyle } from './lib/ffmpeg';
import { transcribeAudio, translateSubtitles, SubtitleSegment } from './lib/gemini';
import { downloadSRT } from './lib/srt';
import { Languages, Wand2, FileAudio, CheckCircle2, AlertCircle, Timer, Play, Settings, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiKeySettings } from './components/ApiKeySettings';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [originalSubtitles, setOriginalSubtitles] = useState<SubtitleSegment[]>([]);
  const [translatedSubtitles, setTranslatedSubtitles] = useState<SubtitleSegment[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [processingType, setProcessingType] = useState<'transcribe' | 'translate' | null>(null);
  const [processStep, setProcessStep] = useState<string>('');
  const [stepProgress, setStepProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  
  const [style, setStyle] = useState<SubtitleStyle>({
    fontSize: 24,
    x: 50,
    y: 90,
    color: '#ffffff',
  });
  const [resolution, setResolution] = useState<string>('original');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    setOriginalSubtitles([]);
    setTranslatedSubtitles([]);
    setError('');
    setCurrentTime(0);
  };

  const simulateProgress = (start: number, end: number, durationMs: number) => {
    let current = start;
    const stepTime = 100;
    const steps = durationMs / stepTime;
    const increment = (end - start) / steps;
    
    const interval = setInterval(() => {
      current += increment;
      if (current >= end) {
        clearInterval(interval);
        setStepProgress(end);
      } else {
        setStepProgress(current);
      }
    }, stepTime);
    
    return interval;
  };

  const handleTranscribe = async () => {
    if (!videoFile) return;
    
    // Check file size (limit to 1GB to prevent browser out-of-memory crashes)
    if (videoFile.size > 1024 * 1024 * 1024) {
      setError('Video file is too large. Please upload a video smaller than 1GB to prevent browser memory issues.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setProcessingType('transcribe');
    setError('');
    setStepProgress(0);
    
    let simInterval: ReturnType<typeof setInterval> | null = null;
    
    try {
      setProcessStep('Initializing media engine & extracting audio...');
      // Start simulating progress immediately so it doesn't sit at 0% while downloading FFmpeg core (~30MB)
      simInterval = simulateProgress(0, 35, 60000); // 0 to 35% over 60s
      
      const audioBlob = await extractAudio(videoFile);
      
      if (simInterval) clearInterval(simInterval);
      
      setProcessStep('Transcribing audio using AI (this may take a minute)...');
      setStepProgress(35);
      simInterval = simulateProgress(35, 95, 30000); // 35% to 95% over 30s
      
      const transcription = await transcribeAudio(audioBlob, userApiKey);
      
      if (simInterval) clearInterval(simInterval);
      setStepProgress(100);
      
      setOriginalSubtitles(transcription);
      setTranslatedSubtitles(transcription); // Default to original
    } catch (err: any) {
      if (simInterval) clearInterval(simInterval);
      setError(err.message || 'An error occurred during transcription. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setTimeout(() => {
        setProcessingType(null);
        setProcessStep('');
        setStepProgress(0);
      }, 500);
    }
  };

  const handleTranslate = async () => {
    if (originalSubtitles.length === 0) return;
    setProcessingType('translate');
    setError('');
    setStepProgress(0);
    
    let simInterval: ReturnType<typeof setInterval> | null = null;
    
    try {
      setProcessStep(`Translating to ${targetLanguage}...`);
      simInterval = simulateProgress(0, 95, 15000); // 0% to 95% over 15s
      
      const translation = await translateSubtitles(originalSubtitles, targetLanguage, userApiKey);
      
      if (simInterval) clearInterval(simInterval);
      setStepProgress(100);
      
      setTranslatedSubtitles(translation);
    } catch (err: any) {
      if (simInterval) clearInterval(simInterval);
      setError(err.message || 'An error occurred during translation. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setTimeout(() => {
        setProcessingType(null);
        setProcessStep('');
        setStepProgress(0);
      }, 500);
    }
  };

  const handleExport = async () => {
    if (!videoFile || translatedSubtitles.length === 0) return;
    setIsExporting(true);
    setError('');
    setExportProgress(0);
    
    try {
      const outputBlob = await exportVideo(
        videoFile,
        translatedSubtitles,
        style,
        resolution,
        (progress) => setExportProgress(progress)
      );
      
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translated_${videoFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'An error occurred during export. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    }
  };

  const handleExportSRT = () => {
    if (translatedSubtitles.length === 0 || !videoFile) return;
    const name = videoFile.name.split('.').slice(0, -1).join('.');
    downloadSRT(translatedSubtitles, `${name}_${targetLanguage}.srt`);
  };

  const languages = [
    'English', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Spanish', 
    'French', 'German', 'Japanese', 'Korean', 'Russian', 'Arabic',
    'Indonesian', 'Portuguese (Brazil)', 'Portuguese (Portugal)'
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Languages className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              GlobalSubs AI
            </h1>
          </div>
          
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
            {!userApiKey && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            {error.includes('Cross-origin isolation') && (
              <button 
                onClick={() => window.location.reload()}
                className="self-start bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Refresh Page
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Video & Controls */}
          <div className="lg:col-span-5 space-y-6">
            {!videoFile ? (
              <VideoUploader onVideoSelect={handleVideoSelect} />
            ) : (
              <div className="bg-black rounded-xl overflow-hidden shadow-lg border border-gray-800 relative group @container">
                <video
                  ref={videoRef}
                  src={videoUrl || undefined}
                  controls
                  className="w-full aspect-video object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />
                
                {/* Subtitle Overlay */}
                {translatedSubtitles.length > 0 && (
                  <div 
                    className="absolute pointer-events-none flex justify-center items-end"
                    style={{
                      left: `${style.x}%`,
                      top: `${style.y}%`,
                      transform: 'translate(-50%, -100%)',
                      width: 'max-content',
                      maxWidth: '90%',
                    }}
                  >
                    <span 
                      style={{
                        fontSize: `calc(${style.fontSize} / 1920 * 100cqw)`,
                        color: style.color,
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000',
                        textAlign: 'center',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {translatedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end)?.text || ''}
                    </span>
                  </div>
                )}

                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {translatedSubtitles.length > 0 && (
                    <button 
                      onClick={() => {
                        if (videoRef.current && translatedSubtitles.length > 0) {
                          videoRef.current.currentTime = translatedSubtitles[0].start;
                          videoRef.current.play();
                        }
                      }}
                      className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm transition-all flex items-center gap-1"
                    >
                      <Wand2 className="w-4 h-4" />
                      Preview
                    </button>
                  )}
                  <button 
                    onClick={() => setVideoFile(null)}
                    className="bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm transition-all"
                  >
                    Change Video
                  </button>
                </div>
              </div>
            )}

            {videoFile && translatedSubtitles.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-blue-500" />
                    Current Segment Adjuster
                  </h4>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        const index = translatedSubtitles.findIndex(s => currentTime >= s.start && currentTime <= s.end);
                        if (index > 0) {
                          videoRef.current!.currentTime = translatedSubtitles[index - 1].start;
                        }
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    >
                      <Play className="w-4 h-4 rotate-180" />
                    </button>
                    <button 
                      onClick={() => {
                        const index = translatedSubtitles.findIndex(s => currentTime >= s.start && currentTime <= s.end);
                        if (index < translatedSubtitles.length - 1) {
                          videoRef.current!.currentTime = translatedSubtitles[index + 1].start;
                        }
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {(() => {
                  const index = translatedSubtitles.findIndex(s => currentTime >= s.start && currentTime <= s.end);
                  const sub = translatedSubtitles[index];
                  if (!sub) return <p className="text-xs text-gray-400 italic">No active segment at current time</p>;
                  
                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-700 font-medium line-clamp-1">{sub.text}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Start Time</label>
                          <div className="flex gap-1">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={sub.start} 
                              onChange={(e) => {
                                const newSubs = [...translatedSubtitles];
                                newSubs[index] = { ...sub, start: parseFloat(e.target.value) };
                                setTranslatedSubtitles(newSubs);
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                            />
                            <button 
                              onClick={() => {
                                const newSubs = [...translatedSubtitles];
                                newSubs[index] = { ...sub, start: parseFloat(currentTime.toFixed(2)) };
                                setTranslatedSubtitles(newSubs);
                              }}
                              className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                            >
                              SET
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">End Time</label>
                          <div className="flex gap-1">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={sub.end} 
                              onChange={(e) => {
                                const newSubs = [...translatedSubtitles];
                                newSubs[index] = { ...sub, end: parseFloat(e.target.value) };
                                setTranslatedSubtitles(newSubs);
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                            />
                            <button 
                              onClick={() => {
                                const newSubs = [...translatedSubtitles];
                                newSubs[index] = { ...sub, end: parseFloat(currentTime.toFixed(2)) };
                                setTranslatedSubtitles(newSubs);
                              }}
                              className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                            >
                              SET
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {videoFile && originalSubtitles.length === 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-blue-500" />
                  Step 1: Extract & Transcribe
                </h3>
                <p className="text-sm text-gray-500">
                  We'll extract the audio and use AI to generate highly accurate timestamps and text.
                </p>
                {processingType === 'transcribe' ? (
                  <div className="w-full space-y-2 pt-2">
                    <div className="flex justify-between text-sm text-gray-600 font-medium">
                      <span>{processStep}</span>
                      <span>{Math.round(stepProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gray-900 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.max(0, Math.min(100, stepProgress))}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleTranscribe}
                    disabled={processingType !== null}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4" />
                    Start Transcription
                  </button>
                )}
              </div>
            )}

            {originalSubtitles.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Languages className="w-5 h-5 text-indigo-500" />
                    Step 2: Translate
                  </h3>
                  {translatedSubtitles !== originalSubtitles && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Translated
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 block">Target Language</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                {processingType === 'translate' ? (
                  <div className="w-full space-y-2 pt-2">
                    <div className="flex justify-between text-sm text-gray-600 font-medium">
                      <span>{processStep}</span>
                      <span>{Math.round(stepProgress)}%</span>
                    </div>
                    <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.max(0, Math.min(100, stepProgress))}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleTranslate}
                    disabled={processingType !== null}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4" />
                    Translate Subtitles
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Editor & Export */}
          <div className="lg:col-span-7 space-y-6">
            <AnimatePresence mode="wait">
              {originalSubtitles.length > 0 && (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                    <p className="text-[11px] text-blue-700 leading-relaxed flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <strong>Tip:</strong> You can import an existing SRT file (e.g. from CapCut) using the "Import SRT" button above to use its exact timing and text as the source.
                    </p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]"
                  >
                    <TranscriptionEditor
                      title="Original Text"
                      subtitles={originalSubtitles}
                      onSubtitlesChange={(newSubs) => {
                        setOriginalSubtitles(newSubs);
                        // Also update translated subtitles if they were the same
                        if (translatedSubtitles === originalSubtitles) {
                          setTranslatedSubtitles(newSubs);
                        }
                      }}
                      currentTime={currentTime}
                      allowImport={true}
                      onSeek={(time) => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = time;
                          videoRef.current.play();
                        }
                      }}
                    />
                    <TranscriptionEditor
                      title={`Translated (${targetLanguage})`}
                      subtitles={translatedSubtitles}
                      onSubtitlesChange={setTranslatedSubtitles}
                      currentTime={currentTime}
                      onSeek={(time) => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = time;
                          videoRef.current.play();
                        }
                      }}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {translatedSubtitles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <SubtitleStyler 
                  style={style} 
                  onStyleChange={setStyle} 
                  onPreview={() => {
                    if (videoRef.current && translatedSubtitles.length > 0) {
                      videoRef.current.currentTime = translatedSubtitles[0].start;
                      videoRef.current.play();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                />
                <ExportSettings
                  resolution={resolution}
                  onResolutionChange={setResolution}
                  onExport={handleExport}
                  onExportSRT={handleExportSRT}
                  isExporting={isExporting}
                  progress={exportProgress}
                />
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <ApiKeySettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onKeySave={setUserApiKey}
      />
    </div>
  );
}


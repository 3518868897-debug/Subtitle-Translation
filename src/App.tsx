/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { TranscriptionEditor } from './components/TranscriptionEditor';
import { SubtitleStyler } from './components/SubtitleStyler';
import { ExportSettings } from './components/ExportSettings';
import { extractAudio, exportVideo, SubtitleStyle, terminateFFmpeg } from './lib/ffmpeg';
import { transcribeAudio, translateSubtitles, SubtitleSegment } from './lib/gemini';
import { downloadSRT, parseSRT } from './lib/srt';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { ApiKeySettings } from './components/ApiKeySettings';
import { UserManual } from './components/UserManual';
import { BookOpen, Languages, Wand2, FileAudio, CheckCircle2, AlertCircle, Timer, Play, Settings, FileText, Plus, Trash2, DownloadCloud, PlayCircle, Loader2, ListChecks } from 'lucide-react';

interface TranslationWorkflow {
  id: string;
  language: string;
  subtitles: SubtitleSegment[];
  status: 'idle' | 'translating' | 'completed' | 'error';
  progress: number;
  error?: string;
}

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
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [workflows, setWorkflows] = useState<TranslationWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  
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
  const [isWidgetMode, setIsWidgetMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'widget') {
      setIsWidgetMode(true);
    }

    const handleMessage = async (event: MessageEvent) => {
      // Basic security: you can add origin checks here if needed
      // if (event.origin !== "https://your-trusted-domain.com") return;

      const { type, payload } = event.data;

      switch (type) {
        case 'LOAD_VIDEO_URL':
          if (payload?.url) {
            try {
              const response = await fetch(payload.url);
              const blob = await response.blob();
              const file = new File([blob], payload.name || "external_video.mp4", { type: blob.type });
              handleVideoSelect(file);
            } catch (err) {
              setError('Failed to load video from URL: ' + (err as Error).message);
            }
          }
          break;
        case 'LOAD_SRT_CONTENT':
          if (payload?.content) {
            const subs = parseSRT(payload.content);
            setOriginalSubtitles(subs);
            setTranslatedSubtitles(subs);
            setError('');
          }
          break;
        case 'SET_API_KEY':
          if (payload?.apiKey) {
            setUserApiKey(payload.apiKey);
            localStorage.setItem('gemini_api_key', payload.apiKey);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const handleSrtSelect = async (file: File) => {
    try {
      const text = await file.text();
      const subs = parseSRT(text);
      if (subs.length === 0) {
        throw new Error('Invalid or empty SRT file.');
      }
      setOriginalSubtitles(subs);
      setTranslatedSubtitles(subs);
      
      // Add initial workflow
      const workflowId = Math.random().toString(36).substr(2, 9);
      const newWorkflow: TranslationWorkflow = {
        id: workflowId,
        language: targetLanguage,
        subtitles: subs,
        status: 'idle',
        progress: 0,
      };
      setWorkflows([newWorkflow]);
      setActiveWorkflowId(workflowId);
      
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to parse SRT file.');
    }
  };

  const handleCancelExport = () => {
    terminateFFmpeg();
    setIsExporting(false);
    setExportProgress(0);
    setProcessStep('');
  };

  const addWorkflow = () => {
    const workflowId = Math.random().toString(36).substr(2, 9);
    const newWorkflow: TranslationWorkflow = {
      id: workflowId,
      language: targetLanguage,
      subtitles: originalSubtitles,
      status: 'idle',
      progress: 0,
    };
    setWorkflows([...workflows, newWorkflow]);
    if (workflows.length === 0) {
      setActiveWorkflowId(workflowId);
    }
  };

  const removeWorkflow = (id: string) => {
    setWorkflows(workflows.filter(w => w.id !== id));
  };

  const updateWorkflowLanguage = (id: string, language: string) => {
    setWorkflows(workflows.map(w => w.id === id ? { ...w, language, status: 'idle' } : w));
  };

  const translateWorkflow = async (id: string) => {
    const workflow = workflows.find(w => w.id === id);
    if (!workflow || originalSubtitles.length === 0) return;

    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: 'translating', progress: 0, error: undefined } : w));

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress > 95) clearInterval(interval);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, progress: Math.min(95, progress) } : w));
    }, 500);

    try {
      const translation = await translateSubtitles(originalSubtitles, workflow.language, userApiKey);
      clearInterval(interval);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, subtitles: translation, status: 'completed', progress: 100 } : w));
      
      // If this is the first completed or currently selected, update preview
      if (targetLanguage === workflow.language) {
        setTranslatedSubtitles(translation);
      }
    } catch (err: any) {
      clearInterval(interval);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: 'error', error: err.message || 'Translation failed' } : w));
    }
  };

  const translateAllWorkflows = async () => {
    const idleWorkflows = workflows.filter(w => w.status === 'idle' || w.status === 'error');
    for (const workflow of idleWorkflows) {
      await translateWorkflow(workflow.id);
    }
  };

  const batchDownloadWorkflows = async () => {
    const completedWorkflows = workflows.filter(w => w.status === 'completed');
    if (completedWorkflows.length === 0) return;

    if (completedWorkflows.length === 1) {
      const w = completedWorkflows[0];
      const name = videoFile ? videoFile.name.split('.').slice(0, -1).join('.') : 'translated_subtitles';
      downloadSRT(w.subtitles, `${name}_${w.language}.srt`);
      return;
    }

    const zip = new JSZip();
    const baseName = videoFile ? videoFile.name.split('.').slice(0, -1).join('.') : 'translated_subtitles';

    completedWorkflows.forEach(w => {
      // Generate SRT content
      const srtContent = w.subtitles.map((sub, i) => {
        const formatTime = (seconds: number) => {
          const date = new Date(seconds * 1000);
          const hh = String(date.getUTCHours()).padStart(2, '0');
          const mm = String(date.getUTCMinutes()).padStart(2, '0');
          const ss = String(date.getUTCSeconds()).padStart(2, '0');
          const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
          return `${hh}:${mm}:${ss},${ms}`;
        };
        return `${i + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
      }).join('\n');
      
      zip.file(`${baseName}_${w.language}.srt`, srtContent);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_translations.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTranslatedSubtitlesChange = (newSubs: SubtitleSegment[]) => {
    setTranslatedSubtitles(newSubs);
    if (activeWorkflowId) {
      setWorkflows(prev => prev.map(w => w.id === activeWorkflowId ? { ...w, subtitles: newSubs } : w));
    }
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

      // Notify parent if embedded
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'TRANSCRIPTION_COMPLETED', payload: { subtitles: transcription } }, '*');
      }
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

      // Notify parent if embedded
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'EXPORT_COMPLETED', payload: { success: true } }, '*');
      }
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
    if (translatedSubtitles.length === 0) return;
    const name = videoFile ? videoFile.name.split('.').slice(0, -1).join('.') : 'translated_subtitles';
    downloadSRT(translatedSubtitles, `${name}_${targetLanguage}.srt`);
  };

  const languages = [
    'English', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Spanish', 
    'French', 'German', 'Japanese', 'Korean', 'Russian', 'Arabic',
    'Indonesian', 'Portuguese (Brazil)', 'Portuguese (Portugal)'
  ];

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200 ${isWidgetMode ? 'p-0' : ''}`}>
      {!isWidgetMode && (
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
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsManualOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">User Manual</span>
              </button>
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
          </div>
        </header>
      )}

      <main className={`${isWidgetMode ? 'max-w-full p-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'} space-y-8`}>
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
            {!videoFile && originalSubtitles.length === 0 ? (
              <VideoUploader onVideoSelect={handleVideoSelect} onSrtSelect={handleSrtSelect} />
            ) : videoFile ? (
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
            ) : (
              <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-4">
                <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">SRT Translation Mode</h3>
                  <p className="text-sm text-gray-500">You are translating an SRT file without a video preview.</p>
                </div>
                <button 
                  onClick={() => {
                    setOriginalSubtitles([]);
                    setTranslatedSubtitles([]);
                  }}
                  className="text-sm text-indigo-600 font-bold hover:underline"
                >
                  ← Back to Upload
                </button>
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-semibold text-gray-900">Translation Workflows</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={translateAllWorkflows}
                      disabled={workflows.filter(w => w.status === 'idle' || w.status === 'error').length === 0}
                      className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Translate All
                    </button>
                    <button
                      onClick={batchDownloadWorkflows}
                      disabled={workflows.filter(w => w.status === 'completed').length === 0}
                      className="text-xs font-bold text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      Batch Download
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {workflows.map((workflow) => (
                    <div 
                      key={workflow.id}
                      className={`p-4 rounded-xl border transition-all ${
                        targetLanguage === workflow.language 
                          ? 'border-indigo-200 bg-indigo-50/30' 
                          : 'border-gray-100 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <select
                            value={workflow.language}
                            onChange={(e) => updateWorkflowLanguage(workflow.id, e.target.value)}
                            disabled={workflow.status === 'translating'}
                            className="bg-white border border-gray-200 text-sm rounded-lg px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {languages.map((lang) => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            {workflow.status === 'translating' && (
                              <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                            )}
                            {workflow.status === 'completed' && (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            )}
                            {workflow.status === 'error' && (
                              <AlertCircle className="w-3 h-3 text-red-500" />
                            )}
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              workflow.status === 'translating' ? 'text-indigo-600' :
                              workflow.status === 'completed' ? 'text-green-600' :
                              workflow.status === 'error' ? 'text-red-600' : 'text-gray-400'
                            }`}>
                              {workflow.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setTargetLanguage(workflow.language);
                              setActiveWorkflowId(workflow.id);
                              setTranslatedSubtitles(workflow.subtitles);
                            }}
                            className={`p-1.5 rounded-lg transition-all ${
                              targetLanguage === workflow.language && activeWorkflowId === workflow.id
                                ? 'bg-indigo-600 text-white' 
                                : 'hover:bg-gray-200 text-gray-500'
                            }`}
                            title="Select for Preview"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => translateWorkflow(workflow.id)}
                            disabled={workflow.status === 'translating'}
                            className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all disabled:opacity-50"
                            title="Translate"
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeWorkflow(workflow.id)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {workflow.status === 'translating' && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${workflow.progress}%` }}
                          ></div>
                        </div>
                      )}
                      
                      {workflow.status === 'error' && (
                        <p className="text-[10px] text-red-600 mt-1">{workflow.error}</p>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={addWorkflow}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Translation Workflow
                  </button>
                </div>
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
                      onSubtitlesChange={handleTranslatedSubtitlesChange}
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
                  onCancel={handleCancelExport}
                  isExporting={isExporting}
                  progress={exportProgress}
                  hasVideo={!!videoFile}
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

      <UserManual 
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />
    </div>
  );
}


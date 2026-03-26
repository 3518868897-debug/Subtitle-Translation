import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Local public URLs
const CORE_PATH = '/ffmpeg/esm/ffmpeg-core.js';
const WASM_PATH = '/ffmpeg/esm/ffmpeg-core.wasm';

// CDN URLs as fallback (using jsdelivr for better reliability)
const CDN_CORE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';
const CDN_WASM_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm';

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) {
    return ffmpeg;
  }

  const loadFFmpegInstance = async (useCDN = false): Promise<FFmpeg> => {
    const instance = new FFmpeg();
    instance.on('log', ({ message }) => {
      console.log(`FFmpeg [${useCDN ? 'CDN' : 'Local'}] log:`, message);
    });

    const baseURL = window.location.origin;
    const coreURL = useCDN ? CDN_CORE_URL : `${baseURL}${CORE_PATH}`;
    const wasmURL = useCDN ? CDN_WASM_URL : `${baseURL}${WASM_PATH}`;
    
    console.log(`Loading FFmpeg core from ${useCDN ? 'CDN' : 'local'}...`, { coreURL, wasmURL });
    
    try {
      const coreBlobURL = await toBlobURL(coreURL, 'text/javascript');
      const wasmBlobURL = await toBlobURL(wasmURL, 'application/wasm');
      
      await instance.load({
        coreURL: coreBlobURL,
        wasmURL: wasmBlobURL,
      });
      return instance;
    } catch (err) {
      console.error(`Failed to load FFmpeg from ${useCDN ? 'CDN' : 'local'}:`, err);
      throw err;
    }
  };

  try {
    console.log('Starting FFmpeg load process...');
    console.log('SharedArrayBuffer status:', typeof SharedArrayBuffer !== 'undefined' ? 'Available' : 'NOT Available');
    console.log('Cross-Origin-Isolated:', window.crossOriginIsolated ? 'Yes' : 'No');
    
    if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
      console.warn('Cross-origin isolation is NOT enabled. Attempting to load anyway, but this will likely fail or be very slow.');
    }

    // Try local first with a shorter timeout (25s), then fallback to CDN
    try {
      ffmpeg = await Promise.race([
        loadFFmpegInstance(false),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Local load timeout')), 25000))
      ]);
      console.log('FFmpeg loaded successfully from local');
    } catch (localError) {
      console.warn('Local FFmpeg load failed or timed out, falling back to CDN...', localError);
      
      // Try CDN with a longer timeout (60s)
      ffmpeg = await Promise.race([
        loadFFmpegInstance(true),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('CDN load timeout')), 60000))
      ]);
      console.log('FFmpeg loaded successfully from CDN');
    }
  } catch (error) {
    console.error('Error loading FFmpeg (both local and CDN failed):', error);
    ffmpeg = null; // Reset so we can try again
    
    let errorMessage = 'Failed to load media engine. ';
    if (!window.crossOriginIsolated) {
      errorMessage += 'Cross-origin isolation is not enabled, which is required for high-performance video processing. We have attempted to auto-fix this; please refresh the page manually if it doesn\'t reload automatically. ';
    } else {
      errorMessage += 'This can happen due to network issues, browser memory limits, or security settings. Please refresh the page and try again.';
    }
    
    throw new Error(errorMessage);
  }

  return ffmpeg;
};

export const extractAudio = async (videoFile: File, onProgress?: (progress: number) => void): Promise<Blob> => {
  console.log('Starting extractAudio...');
  const ff = await getFFmpeg();
  console.log('FFmpeg instance obtained.');
  
  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(progress);
  };
  
  if (onProgress) {
    ff.on('progress', progressHandler);
  }
  
  try {
    const ext = videoFile.name.split('.').pop() || 'mp4';
    const inputName = `input.${ext}`;
    
    console.log(`Writing file ${inputName} to FFmpeg FS...`);
    await ff.writeFile(inputName, await fetchFile(videoFile));
    console.log('File written successfully.');
    
    // Extract audio as mp3
    console.log('Executing FFmpeg command to extract audio...');
    await ff.exec(['-threads', '0', '-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'audio.mp3']);
    console.log('FFmpeg command execution completed.');
    
    console.log('Reading extracted audio from FFmpeg FS...');
    const audioData = await ff.readFile('audio.mp3');
    console.log('Audio read successfully.');
    
    return new Blob([audioData], { type: 'audio/mp3' });
  } catch (error) {
    console.error('Error in extractAudio:', error);
    throw new Error('Failed to extract audio from video. Please ensure the video format is supported.');
  } finally {
    if (onProgress) {
      ff.off('progress', progressHandler);
    }
  }
};

export interface SubtitleStyle {
  fontSize: number;
  x: number;
  y: number;
  color: string;
}

export const generateSrt = (subtitles: { start: number; end: number; text: string }[]): string => {
  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  };

  return subtitles
    .map((sub, index) => {
      return `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
    })
    .join('\n');
};

export const exportVideo = async (
  videoFile: File,
  subtitles: { start: number; end: number; text: string }[],
  style: SubtitleStyle,
  resolution: string,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  const ff = await getFFmpeg();
  
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(progress);
  };

  ff.on('progress', progressHandler);

  try {
    const ext = videoFile.name.split('.').pop() || 'mp4';
    const inputName = `input.${ext}`;

    await ff.writeFile(inputName, await fetchFile(videoFile));
    
    // Load a default font to ensure ASS rendering works for CJK characters
    try {
      try {
        await ff.createDir('fonts');
      } catch (e) {
        // Directory might already exist, ignore
      }
      // Use LXGW WenKai which supports Chinese and English
      const fontData = await fetchFile('https://cdn.jsdelivr.net/npm/lxgwwenkai-fontface@1.0.0/fonts/lxgwwenkai/LXGWWenKai-Regular.ttf');
      await ff.writeFile('fonts/LXGWWenKai-Regular.ttf', fontData);
    } catch (e) {
      console.warn("Failed to load font, subtitles might not render correctly", e);
    }

    const assContent = generateAss(subtitles, style);
    await ff.writeFile('subtitles.ass', assContent);

    const args = ['-i', inputName];
    
    // Resolution scaling
    let scaleFilter = '';
    if (resolution === '1080p') scaleFilter = 'scale=-2:1080,';
    else if (resolution === '2k') scaleFilter = 'scale=-2:1440,';
    else if (resolution === '4k') scaleFilter = 'scale=-2:2160,';

    args.push('-vf', `${scaleFilter}ass=subtitles.ass:fontsdir=/fonts`);
    
    // Output settings - using CRF 28 for faster encoding with good quality
    // Added -threads 0 to use all available cores
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-threads', '0', '-c:a', 'aac', '-b:a', '128k', 'output.mp4');

    const code = await ff.exec(args);
    
    if (code !== 0) {
      throw new Error(`FFmpeg encoding failed with exit code ${code}. Check console for details.`);
    }
    
    const outputData = await ff.readFile('output.mp4');
    return new Blob([outputData], { type: 'video/mp4' });
  } finally {
    ff.off('progress', progressHandler);
  }
};

const generateAss = (subtitles: { start: number; end: number; text: string }[], style: SubtitleStyle): string => {
  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const h = date.getUTCHours();
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const cs = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
    return `${h}:${mm}:${ss}.${cs}`;
  };

  // Convert hex color to ASS color format (&HBBGGRR&)
  const hexToAssColor = (hex: string) => {
    const r = hex.slice(1, 3);
    const g = hex.slice(3, 5);
    const b = hex.slice(5, 7);
    return `&H00${b}${g}${r}`;
  };

  const assColor = hexToAssColor(style.color);
  
  // Alignment: 1=Bottom Left, 2=Bottom Center, 3=Bottom Right, 4=Mid Left, 5=Mid Center, 6=Mid Right, 7=Top Left, 8=Top Center, 9=Top Right
  // We'll use 5 (Mid Center) and use margins to position.
  // Actually, ASS allows absolute positioning with \pos(x,y) tag.
  
  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,LXGW WenKai,${style.fontSize},${assColor},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  subtitles.forEach((sub) => {
    // Using \pos tag for absolute positioning based on percentage of 1920x1080
    const posX = (style.x / 100) * 1920;
    const posY = (style.y / 100) * 1080;
    ass += `Dialogue: 0,${formatTime(sub.start)},${formatTime(sub.end)},Default,,0,0,0,,{\\pos(${posX},${posY})}${sub.text}\n`;
  });

  return ass;
};

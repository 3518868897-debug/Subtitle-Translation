import { SubtitleSegment } from './gemini';

/**
 * Formats seconds into SRT timestamp format: HH:MM:SS,mmm
 */
const formatTimestamp = (seconds: number): string => {
  const date = new Date(seconds * 1000);
  const hh = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const mmm = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
};

/**
 * Parses SRT timestamp format (HH:MM:SS,mmm) into seconds
 */
const parseTimestamp = (timestamp: string): number => {
  const parts = timestamp.split(':');
  const secondsParts = parts[2].split(',');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(secondsParts[0], 10);
  const ms = parseInt(secondsParts[1], 10);
  return h * 3600 + m * 60 + s + ms / 1000;
};

/**
 * Converts SubtitleSegment array to SRT string
 */
export const generateSRT = (subtitles: SubtitleSegment[]): string => {
  return subtitles
    .map((sub, index) => {
      const start = formatTimestamp(sub.start);
      const end = formatTimestamp(sub.end);
      return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join('\n');
};

/**
 * Parses SRT string into SubtitleSegment array
 */
export const parseSRT = (srtContent: string): SubtitleSegment[] => {
  const segments: SubtitleSegment[] = [];
  // Normalize line endings to \n and split by double newline (with optional carriage returns)
  const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    // An SRT block should have at least 3 lines: index, time, and text
    // But sometimes text can be empty, so we check for the time line specifically
    const timeLineIndex = lines.findIndex(line => line.includes(' --> '));
    
    if (timeLineIndex !== -1 && lines.length > timeLineIndex + 1) {
      const timeLine = lines[timeLineIndex];
      const timeMatch = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3}) --> (\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
      
      if (timeMatch) {
        const start = parseTimestamp(timeMatch[1].replace('.', ','));
        const end = parseTimestamp(timeMatch[2].replace('.', ','));
        // Text starts after the time line
        const text = lines.slice(timeLineIndex + 1).join('\n').trim();
        if (text || segments.length === 0 || start !== end) { // Basic sanity check
          segments.push({ start, end, text });
        }
      }
    }
  }

  return segments;
};

/**
 * Triggers a download of the SRT file
 */
export const downloadSRT = (subtitles: SubtitleSegment[], filename: string) => {
  const srtContent = generateSRT(subtitles);
  const blob = new Blob([srtContent], { type: 'text/srt;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.srt') ? filename : `${filename}.srt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

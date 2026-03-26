import { GoogleGenAI, Type } from '@google/genai';

const getAi = (userKey?: string) => {
  const apiKey = userKey || localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API Key is missing. Please set your Gemini API Key in the settings (top right corner).');
  }
  return new GoogleGenAI({ apiKey });
};

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const transcribeAudio = async (audioBlob: Blob, userKey?: string): Promise<SubtitleSegment[]> => {
  console.log('Starting transcribeAudio...');
  const ai = getAi(userKey);
  console.log('Converting audio blob to base64...');
  const base64Data = await blobToBase64(audioBlob);
  console.log('Audio converted to base64. Calling Gemini API...');

  try {
    const apiCall = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
               mimeType: audioBlob.type || 'audio/mp3',
               data: base64Data,
            },
          },
          {
            text: `You are a professional transcriber. Transcribe the ENTIRE audio file from the very beginning to the very end. Do not skip any spoken words. 
            Output the transcription as a JSON array of objects, where each object represents a spoken sentence or phrase. 
            Each object must have 'start' (start time in seconds as a number, e.g., 1.5), 'end' (end time in seconds as a number, e.g., 4.2), and 'text' (the transcribed text). 
            Ensure the timestamps are as accurate as possible and cover the full duration of the audio. 
            Do not include any markdown formatting outside the JSON array.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER, description: 'Start time in seconds' },
              end: { type: Type.NUMBER, description: 'End time in seconds' },
              text: { type: Type.STRING, description: 'Transcribed text' },
            },
            required: ['start', 'end', 'text'],
          },
        },
        temperature: 0.1,
        maxOutputTokens: 8192, // Explicitly set to a high value
      },
    });

    // 3 minute timeout for AI transcription
    const response = await Promise.race([
      apiCall,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('AI transcription timed out after 3 minutes.')), 180000))
    ]);

    console.log('Gemini API response received.');
    const jsonStr = response.text?.trim() || '[]';
    return JSON.parse(jsonStr) as SubtitleSegment[];
  } catch (error) {
    console.error('Error in transcribeAudio:', error);
    throw new Error(error instanceof Error ? error.message : 'Transcription failed. The audio might be too long or the AI service is currently unavailable.');
  }
};

export const translateSubtitles = async (
  subtitles: SubtitleSegment[],
  targetLanguage: string,
  userKey?: string
): Promise<SubtitleSegment[]> => {
  const ai = getAi(userKey);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a professional, context-aware translator. Translate the following JSON array of transcribed text segments from the original language to ${targetLanguage}. 
    Maintain the exact same JSON structure, but replace the 'text' field with the translated text. 
    Ensure the translation is natural and fits the context of the entire conversation. 
    Translate ALL segments provided. Do not skip any segments. 
    Do not include any markdown formatting outside the JSON array.\n\n${JSON.stringify(subtitles)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.NUMBER, description: 'Start time in seconds' },
            end: { type: Type.NUMBER, description: 'End time in seconds' },
            text: { type: Type.STRING, description: 'Translated text' },
          },
          required: ['start', 'end', 'text'],
        },
      },
      temperature: 0.3,
      maxOutputTokens: 8192, // Explicitly set to a high value
    },
  });

  try {
    const jsonStr = response.text?.trim() || '[]';
    return JSON.parse(jsonStr) as SubtitleSegment[];
  } catch (error) {
    console.error('Failed to parse translation JSON:', error);
    throw new Error('Translation failed to produce valid JSON.');
  }
};

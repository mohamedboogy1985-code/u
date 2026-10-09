export type TranscriptionMode = 'verbatim' | 'smart';

export type AppLanguage = 'ar' | 'en';

export type ActiveTab = 'live' | 'file';

export type ViewLayout = 'split' | 'smart' | 'verbatim';

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: string;
  confidence?: number;
  isFinal: boolean;
}

export interface SetupConfig {
  model: string;
  customVocabulary: string[];
  languageCodes: string[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'recording' | 'error';

export interface ServerContent {
  interimInputTranscription?: {
    text: string;
  };
  inputTranscription?: {
    text: string;
  };
  interim_input_transcription?: {
    text: string;
  };
  input_transcription?: {
    text: string;
  };
  [key: string]: unknown;
}

export interface GeminiResponsePayload {
  type: 'gemini_response' | 'connected' | 'disconnected' | 'error';
  mode?: TranscriptionMode;
  raw?: unknown;
  serverContent?: ServerContent | null;
  status?: string;
  error?: string;
  reason?: string;
}

export interface AnalysisResult {
  overallScore: number;
  speakingPaceWpm: number;
  speakingPaceFeedback: string;
  sentenceFormation: string;
  speakingStyle: string;
  fillerWordsCount: number;
  fillerWordsList: string[];
  overallFeedback: string;
  strengths: string[];
  areasForImprovement: string[];
  // Enhanced breakdown metrics
  totalWords?: number;
  netWords?: number;
  durationSeconds?: number;
  grossWpm?: number;
  netWpm?: number;
  fillerWordsBreakdown?: { word: string; count: number }[];
  fillerWordsRetentionExplanation?: string;
}

export interface FileTranscriptionResult {
  smart: string;
  verbatim: string;
  language?: string;
  fillerWords?: string[];
  summary?: string;
}

export interface SavedTranscription {
  id: string;
  userId: string;
  smartText: string;
  verbatimText: string;
  durationSeconds: number;
  wordCount: number;
  language?: string;
  summary?: string;
  source?: 'live' | 'file' | 'voice_live';
  createdAt: string;
}

export type KeywordCategory = 'person' | 'location' | 'organization' | 'tech' | 'datetime' | 'action';

export interface KeywordClassification {
  category: KeywordCategory;
  labelAr: string;
  labelEn: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  iconName: string;
}


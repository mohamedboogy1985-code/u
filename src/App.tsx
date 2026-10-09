import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SetupPanel } from './components/SetupPanel';
import { AnalysisModal } from './components/AnalysisModal';
import { AudioFileUpload } from './components/AudioFileUpload';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { VoiceReplyPanel } from './components/VoiceReplyPanel';
import { CloudHistoryModal } from './components/CloudHistoryModal';
import {
  Play,
  Square,
  SlidersHorizontal,
  Pause,
  Wand2,
  Mic,
  Copy,
  Download,
  Search,
  Sparkles,
  RotateCcw,
  Languages,
  Check,
  FileAudio,
  Radio,
  Columns2,
  Maximize2,
  Edit3,
  BarChart3,
  Info,
  Tag,
  Layers,
  Filter,
  Eye,
  RefreshCw,
  Bot,
  Volume2,
  Cloud,
  Database,
  Save,
  User as UserIcon,
} from 'lucide-react';
import {
  ConnectionStatus,
  SetupConfig,
  TranscriptSegment,
  GeminiResponsePayload,
  AnalysisResult,
  AppLanguage,
  ActiveTab,
  ViewLayout,
  FileTranscriptionResult,
  KeywordCategory,
  KeywordClassification,
  SavedTranscription,
} from './types';
import {
  floatTo16BitPCM,
  arrayBufferToBase64,
  calculateAudioLevel,
} from './utils/audio';
import { classifyWord, KEYWORD_CATEGORIES } from './utils/entityClassifier';
import {
  User,
  subscribeToAuth,
  signInWithGoogle,
  logOut,
  saveTranscriptionToFirestore,
  getUserTranscriptions,
  deleteTranscriptionFromFirestore,
  testFirestoreConnection,
  saveChatMessage,
} from './firebase';

const SENTENCE_COLORS = [
  '#f87171', // Red
  '#fb923c', // Orange
  '#fbbf24', // Amber
  '#a3e635', // Lime
  '#4ade80', // Green
  '#34d399', // Emerald
  '#2dd4bf', // Teal
  '#38bdf8', // Light Blue
  '#60a5fa', // Blue
  '#818cf8', // Indigo
  '#a78bfa', // Violet
  '#c084fc', // Purple
  '#e879f9', // Fuchsia
  '#f472b6', // Pink
  '#fb7185', // Rose
];

const COMMON_FILLER_WORDS = new Set([
  // English
  'um', 'uh', 'er', 'ah', 'like', 'literally', 'basically', 'actually', 
  'seriously', 'totally', 'obviously', 'essentially', 'right', 'okay', 'so', 
  'well', 'yeah', 'yep', 'nope', 'huh', 'hmm', 'you know',
  // Arabic (normalized)
  'يعني', 'ام', 'أم', 'اه', 'أه', 'امم', 'أمم', 'مثلا', 'مثلاً',
  'اصلا', 'أصلاً', 'بص', 'طيب', 'فاهم', 'خلاص', 'تمام', 'والله', 'ها'
]);

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9'\u0600-\u06FF]/g, '').trim();
}

function isFillerWord(rawWord: string): boolean {
  const clean = normalizeWord(rawWord);
  return COMMON_FILLER_WORDS.has(clean);
}

function isSentenceEndingWord(rawWord: string): boolean {
  return /[.!?؟]$/.test(rawWord.trim());
}

const AnimatedWord = React.memo(({
  word,
  color,
  isFiller,
  isHighlighted,
  classification,
  showCategoryBadge,
  isDimmed,
}: {
  word: string;
  color: string;
  isFiller?: boolean;
  isHighlighted?: boolean;
  classification?: KeywordClassification | null;
  showCategoryBadge?: boolean;
  isDimmed?: boolean;
}) => {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: isDimmed ? 0.25 : isFiller ? 0.8 : 1,
        scale: isDimmed ? 0.95 : 1,
      }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={`inline-flex items-center gap-1 relative px-2.5 py-0.5 mx-1 my-1 text-white font-medium rounded-lg shadow-sm transition-all group ${
        isHighlighted
          ? 'ring-2 ring-yellow-400 bg-yellow-600 scale-105 z-10'
          : ''
      } ${
        isFiller
          ? 'italic border-b-2 border-dotted border-white/60 ring-1 ring-amber-400/50'
          : ''
      } ${
        classification && !isDimmed
          ? 'ring-1 ring-white/30 shadow-md hover:scale-105'
          : ''
      }`}
      style={{
        backgroundColor: isHighlighted
          ? undefined
          : classification && !isDimmed
          ? classification.color
          : color,
      }}
      title={
        classification
          ? `${classification.labelAr} / ${classification.labelEn}`
          : undefined
      }
    >
      <span className="whitespace-nowrap">{word}</span>
      {classification && showCategoryBadge && !isDimmed && (
        <span
          className="text-[10px] px-1 py-0.5 rounded font-mono font-bold leading-none bg-black/40 text-white/95 border border-white/20 shrink-0 select-none"
        >
          {classification.category === 'person' && '👤'}
          {classification.category === 'location' && '📍'}
          {classification.category === 'organization' && '🏢'}
          {classification.category === 'tech' && '💻'}
          {classification.category === 'datetime' && '📅'}
          {classification.category === 'action' && '⚡'}
        </span>
      )}
    </motion.span>
  );
});
AnimatedWord.displayName = 'AnimatedWord';

export default function App() {
  const [appLang, setAppLang] = useState<AppLanguage>('ar');
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [viewLayout, setViewLayout] = useState<ViewLayout>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditable, setIsEditable] = useState(false);
  const [copiedMode, setCopiedMode] = useState<string | null>(null);

  // Keyword Classification State
  const [isKeywordHighlighting, setIsKeywordHighlighting] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<KeywordCategory | 'all'>('all');
  const [aiClassifiedEntities, setAiClassifiedEntities] = useState<{ text: string; category: KeywordCategory }[]>([]);
  const [isClassifyingAi, setIsClassifyingAi] = useState(false);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<SetupConfig>({
    model: 'models/gemini-3.5-transcribe-live',
    customVocabulary: ['يعني', 'أم', 'أه', 'like', 'um', 'uh', 'Gemini'],
    languageCodes: ['ar', 'en-US'],
  });

  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Left Column State (Verbatim Mode)
  const [verbatimSegments, setVerbatimSegments] = useState<TranscriptSegment[]>([]);
  const [verbatimInterimText, setVerbatimInterimText] = useState('');

  // Right Column State (Smart Mode)
  const [smartSegments, setSmartSegments] = useState<TranscriptSegment[]>([]);
  const [smartInterimText, setSmartInterimText] = useState('');

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [paceMode, setPaceMode] = useState<'gross' | 'net'>('gross');

  // File Upload State
  const [isFileTranscribing, setIsFileTranscribing] = useState(false);
  const [fileTranscriptionMeta, setFileTranscriptionMeta] = useState<FileTranscriptionResult | null>(null);

  // AI Voice Reply State
  const [isVoiceReplyOpen, setIsVoiceReplyOpen] = useState(false);
  const [voiceReplyText, setVoiceReplyText] = useState<string | null>(null);
  const [voiceReplyAudioBase64, setVoiceReplyAudioBase64] = useState<string | null>(null);
  const [isVoiceReplyLoading, setIsVoiceReplyLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [autoVoiceReply, setAutoVoiceReply] = useState(false);

  // Firebase Auth & Cloud Firestore State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedTranscriptions, setSavedTranscriptions] = useState<SavedTranscription[]>([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudToastMessage, setCloudToastMessage] = useState<string | null>(null);
  const [autoSaveToCloud, setAutoSaveToCloud] = useState(true);

  const currentUserRef = useRef<User | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const autoSaveToCloudRef = useRef(autoSaveToCloud);
  useEffect(() => {
    autoSaveToCloudRef.current = autoSaveToCloud;
  }, [autoSaveToCloud]);

  // Audio & Connection Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const leftTranscriptEndRef = useRef<HTMLDivElement>(null);
  const rightTranscriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordedAudioBase64Ref = useRef<string | null>(null);
  const recordedAudioMimeTypeRef = useRef<string | null>(null);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const recordingSecondsRef = useRef(recordingSeconds);
  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  const smartSegmentsRef = useRef(smartSegments);
  useEffect(() => {
    smartSegmentsRef.current = smartSegments;
  }, [smartSegments]);

  const verbatimSegmentsRef = useRef(verbatimSegments);
  useEffect(() => {
    verbatimSegmentsRef.current = verbatimSegments;
  }, [verbatimSegments]);

  const autoVoiceReplyRef = useRef(autoVoiceReply);
  useEffect(() => {
    autoVoiceReplyRef.current = autoVoiceReply;
  }, [autoVoiceReply]);

  // Fetch Cloud Transcriptions
  const fetchCloudTranscriptions = useCallback(async (uid?: string) => {
    const targetUid = uid || currentUserRef.current?.uid;
    if (!targetUid) return;
    setIsCloudLoading(true);
    try {
      const items = await getUserTranscriptions(targetUid);
      setSavedTranscriptions(items);
    } catch (err) {
      console.error('Failed to load cloud transcriptions:', err);
    } finally {
      setIsCloudLoading(false);
    }
  }, []);

  // Initialize Firebase Firestore connection & subscribe to auth
  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        fetchCloudTranscriptions(user.uid);
      } else {
        setSavedTranscriptions([]);
      }
    });
    return () => unsubscribe();
  }, [fetchCloudTranscriptions]);

  // Sync document dir & lang attribute
  useEffect(() => {
    document.documentElement.lang = appLang;
    document.documentElement.dir = appLang === 'ar' ? 'rtl' : 'ltr';
  }, [appLang]);

  // Auto-scroll transcripts
  useEffect(() => {
    if (leftTranscriptEndRef.current) {
      leftTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [verbatimSegments, verbatimInterimText]);

  useEffect(() => {
    if (rightTranscriptEndRef.current) {
      rightTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [smartSegments, smartInterimText]);

  const isArabic = appLang === 'ar';

  const stopAudio = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const getAudioBase64 = new Promise<{ base64: string; mimeType: string }>((resolve) => {
        mediaRecorderRef.current!.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current!.mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: audioBlob.type });
          };
        };
      });
      mediaRecorderRef.current.stop();
      
      try {
        const audioData = await getAudioBase64;
        audioBase64 = audioData.base64;
        audioMimeType = audioData.mimeType;
        recordedAudioBase64Ref.current = audioBase64;
        recordedAudioMimeTypeRef.current = audioMimeType;
      } catch (err) {
        console.error('Failed to encode audio', err);
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }
    analyserRef.current = null;
    setAnalyserNode(null);
    setAudioLevel(0);
    setStatus('disconnected');

    // Auto-save to Firebase Firestore if signed in
    if (autoSaveToCloudRef.current && currentUserRef.current) {
      setTimeout(() => {
        const smartText = smartSegmentsRef.current.map((s) => s.text).join('\n');
        const verbatimText = verbatimSegmentsRef.current.map((s) => s.text).join('\n');
        if ((smartText.trim() || verbatimText.trim()) && currentUserRef.current) {
          const wordCount = (smartText || verbatimText).split(/\s+/).filter(Boolean).length;
          saveTranscriptionToFirestore(currentUserRef.current.uid, {
            smartText: smartText || verbatimText,
            verbatimText: verbatimText || smartText,
            durationSeconds: recordingSecondsRef.current,
            wordCount,
            language: appLang === 'ar' ? 'العربية' : 'English',
            source: 'live',
          })
            .then(() => fetchCloudTranscriptions(currentUserRef.current?.uid))
            .catch((err) => console.warn('Auto-save to Firestore failed:', err));
        }
      }, 500);
    }

    if (autoVoiceReplyRef.current) {
      setTimeout(() => {
        handleTriggerVoiceReply();
      }, 700);
    }
  }, [appLang, fetchCloudTranscriptions]);

  const handleServerMessage = useCallback((event: MessageEvent) => {
    try {
      const payload: GeminiResponsePayload = JSON.parse(event.data);
      if (payload.type === 'connected') {
        setStatus('recording');
        setErrorMessage(null);
      } else if (payload.type === 'error') {
        setErrorMessage(payload.error || (isArabic ? 'خطأ في الاتصال بـ Gemini API' : 'Gemini API Error'));
        setStatus('error');
      } else if (payload.type === 'gemini_response' && payload.serverContent) {
        const serverContent = payload.serverContent;
        const interim =
          serverContent.interimInputTranscription?.text ||
          serverContent.interim_input_transcription?.text;
        const finalContent =
          serverContent.inputTranscription?.text ||
          serverContent.input_transcription?.text;

        const targetMode = payload.mode || 'smart';

        if (targetMode === 'smart') {
          if (interim !== undefined) {
            setSmartInterimText(interim);
          }
          if (finalContent && finalContent.trim().length > 0) {
            const newSegment: TranscriptSegment = {
              id: `smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              text: finalContent.trim(),
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              isFinal: true,
            };
            setSmartSegments((prev) => [...prev, newSegment]);
            setSmartInterimText('');
          }
        } else {
          // Verbatim mode
          if (interim !== undefined) {
            setVerbatimInterimText(interim);
          }
          if (finalContent && finalContent.trim().length > 0) {
            const newSegment: TranscriptSegment = {
              id: `verbatim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              text: finalContent.trim(),
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              isFinal: true,
            };
            setVerbatimSegments((prev) => [...prev, newSegment]);
            setVerbatimInterimText('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, [isArabic]);

  const startRecording = async () => {
    setErrorMessage(null);
    setSmartSegments([]);
    setSmartInterimText('');
    setVerbatimSegments([]);
    setVerbatimInterimText('');
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    recordedAudioBase64Ref.current = null;
    recordedAudioMimeTypeRef.current = null;
    setFileTranscriptionMeta(null);

    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Audio recorder
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (recErr) {
        console.warn('MediaRecorder not available or failed:', recErr);
      }

      // Audio Context for real-time PCM extraction
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      setAnalyserNode(analyser);

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      // WebSocket Connection to Backend Proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/transcribe`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send initial configuration
        ws.send(
          JSON.stringify({
            type: 'configure',
            model: config.model,
            languageCodes: config.languageCodes,
            customVocabulary: config.customVocabulary,
          })
        );
      };

      ws.onmessage = handleServerMessage;

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setErrorMessage(
          isArabic
            ? 'خطأ في اتصال خادم النسخ الفوري. تحقق من إعداد مفتاح GEMINI_API_KEY.'
            : 'WebSocket connection error. Verify GEMINI_API_KEY.'
        );
        setStatus('error');
      };

      ws.onclose = () => {
        if (status === 'recording' || status === 'connecting') {
          setStatus('disconnected');
        }
      };

      // Stream PCM chunks to WebSocket
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const level = calculateAudioLevel(inputData);
        setAudioLevel(level);

        if (ws.readyState === WebSocket.OPEN) {
          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16);
          ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64,
              mimeType: 'audio/pcm;rate=16000',
            })
          );
        }
      };

      // Recording elapsed timer
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Error starting audio recording:', err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Permission') || message.includes('denied')) {
        setErrorMessage(
          isArabic
            ? 'تم رفض إذن الوصول إلى الميكروفون. يرجى تفعيل إذن الميكروفون في المتصفح.'
            : 'Microphone access denied. Please allow microphone permissions in your browser.'
        );
      } else {
        setErrorMessage(
          isArabic ? `خطأ في الميكروفون: ${message}` : `Microphone error: ${message}`
        );
      }
      setStatus('error');
    }
  };

  // Analyze Speech Handler
  const triggerSpeechAnalysis = async () => {
    const transcript =
      verbatimSegments.map((s) => s.text).join(' ') ||
      smartSegments.map((s) => s.text).join(' ');

    if (!transcript.trim()) {
      setErrorMessage(
        isArabic ? 'لا يوجد نص منسوخ لتحليله حتى الآن. يرجى التحدث أولاً.' : 'No transcript available to analyze yet.'
      );
      return;
    }

    setIsAnalyzing(true);
    setIsAnalysisModalOpen(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          durationSeconds: Math.max(1, recordingSeconds || 30),
          audioBase64: recordedAudioBase64Ref.current || undefined,
          audioMimeType: recordedAudioMimeTypeRef.current || undefined,
          language: appLang,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis request failed');
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
    } catch (err) {
      console.error('Speech analysis error:', err);
      setErrorMessage(
        isArabic ? 'فشل إتمام تحليل الصوت. يرجى المحاولة مجدداً.' : 'Failed to analyze speech. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Audio File Transcription completion
  const handleFileTranscriptionComplete = (result: FileTranscriptionResult) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setFileTranscriptionMeta(result);

    // Populate Smart segments
    setSmartSegments([
      {
        id: `file_smart_${Date.now()}`,
        text: result.smart,
        timestamp,
        isFinal: true,
      },
    ]);
    setSmartInterimText('');

    // Populate Verbatim segments
    setVerbatimSegments([
      {
        id: `file_verbatim_${Date.now()}`,
        text: result.verbatim,
        timestamp,
        isFinal: true,
      },
    ]);
    setVerbatimInterimText('');
  };

  // Trigger AI Voice Reply
  const handleTriggerVoiceReply = useCallback(async () => {
    const transcript =
      smartSegmentsRef.current.map((s) => s.text).join(' ') ||
      verbatimSegmentsRef.current.map((s) => s.text).join(' ');

    if (!transcript.trim()) {
      setErrorMessage(
        isArabic
          ? 'يرجى التحدث أو تسجيل صوت أولاً ليتمكن الذكاء الاصطناعي من الرد عليك بالصوت.'
          : 'Please speak or record something first.'
      );
      return;
    }

    setIsVoiceReplyLoading(true);
    setIsVoiceReplyOpen(true);
    setVoiceReplyText(null);
    setVoiceReplyAudioBase64(null);

    try {
      const response = await fetch('/api/ai-voice-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          language: appLang,
          voiceName: selectedVoice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI voice reply');
      }

      const data = await response.json();
      setVoiceReplyText(data.replyText);
      setVoiceReplyAudioBase64(data.audioBase64);

      // Persist conversation to Firestore chatHistory
      if (currentUserRef.current) {
        saveChatMessage(currentUserRef.current.uid, {
          role: 'user',
          content: transcript,
          modelUsed: 'gemini-3.8-flash',
        }).catch((err) => console.warn('Could not save user chat in Firestore:', err));

        saveChatMessage(currentUserRef.current.uid, {
          role: 'model',
          content: data.replyText,
          modelUsed: 'gemini-3.8-flash-lite-tts',
        }).catch((err) => console.warn('Could not save model chat in Firestore:', err));
      }
    } catch (err: unknown) {
      console.error('AI voice reply error:', err);
      setErrorMessage(
        isArabic ? 'تعذر توليد الرد الصوتي، يرجى المحاولة مرة أخرى.' : 'Failed to generate voice reply.'
      );
    } finally {
      setIsVoiceReplyLoading(false);
    }
  }, [appLang, isArabic, selectedVoice]);

  // Save current transcript to Cloud Firestore
  const handleSaveCurrentToCloud = useCallback(async (explicitSource?: 'live' | 'file' | 'voice_live') => {
    const smartText = smartSegmentsRef.current.map((s) => s.text).join('\n');
    const verbatimText = verbatimSegmentsRef.current.map((s) => s.text).join('\n');

    if (!smartText.trim() && !verbatimText.trim()) {
      setErrorMessage(isArabic ? 'لا يوجد نص منسوخ للحفظ.' : 'No transcript available to save.');
      return;
    }

    if (!currentUserRef.current) {
      setIsCloudModalOpen(true);
      return;
    }

    setIsSavingToCloud(true);
    try {
      const source = explicitSource || (activeTab === 'file' ? 'file' : 'live');
      const textForCount = smartText || verbatimText;
      const wordCount = textForCount.split(/\s+/).filter(Boolean).length;
      await saveTranscriptionToFirestore(currentUserRef.current.uid, {
        smartText: smartText || verbatimText,
        verbatimText: verbatimText || smartText,
        durationSeconds: recordingSecondsRef.current || (fileTranscriptionMeta ? 60 : 0),
        wordCount,
        language: appLang === 'ar' ? 'العربية' : 'English',
        summary: fileTranscriptionMeta?.summary || (textForCount.slice(0, 100) + '...'),
        source,
      });

      await fetchCloudTranscriptions(currentUserRef.current.uid);
      setCloudToastMessage(
        isArabic
          ? 'تم حفظ التسجيل بنجاح في قاعدة بيانات Firestore السحابية!'
          : 'Saved successfully to Cloud Firestore!'
      );
      setTimeout(() => setCloudToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Cloud save failed:', err);
      setErrorMessage(err.message || 'Failed to save to Cloud Firestore');
    } finally {
      setIsSavingToCloud(false);
    }
  }, [activeTab, fileTranscriptionMeta, appLang, isArabic, fetchCloudTranscriptions]);

  // Delete saved item from Cloud Firestore
  const handleDeleteCloudItem = useCallback(async (id: string) => {
    if (!currentUserRef.current) return;
    await deleteTranscriptionFromFirestore(currentUserRef.current.uid, id);
    await fetchCloudTranscriptions(currentUserRef.current.uid);
  }, [fetchCloudTranscriptions]);

  // Load saved item from Cloud Firestore back into Studio editor
  const handleLoadSavedIntoEditor = useCallback((item: SavedTranscription) => {
    const smartLines = item.smartText.split('\n').filter(Boolean);
    const verbatimLines = item.verbatimText.split('\n').filter(Boolean);

    setSmartSegments(
      smartLines.map((line, idx) => ({
        id: `loaded-smart-${Date.now()}-${idx}`,
        text: line,
        timestamp: new Date().toLocaleTimeString(),
        isFinal: true,
      }))
    );
    setSmartInterimText('');

    setVerbatimSegments(
      verbatimLines.map((line, idx) => ({
        id: `loaded-verbatim-${Date.now()}-${idx}`,
        text: line,
        timestamp: new Date().toLocaleTimeString(),
        isFinal: true,
      }))
    );
    setVerbatimInterimText('');

    if (item.durationSeconds) {
      setRecordingSeconds(item.durationSeconds);
    }
    setActiveTab('live');
    setCloudToastMessage(
      isArabic ? 'تم استرجاع التسجيل في شاشة النسخ بنجاح' : 'Loaded transcription into Studio'
    );
    setTimeout(() => setCloudToastMessage(null), 3000);
  }, [isArabic]);

  // Read aloud any text using Gemini TTS or Web Speech API
  const speakText = async (text: string) => {
    if (!text.trim()) return;
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName: selectedVoice,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('Backend TTS failed, using browser synthesis:', e);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = isArabic ? 'ar-SA' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Trigger AI Keyword and Entity classification
  const triggerAiKeywordExtraction = async () => {
    const transcript = smartSegments.map((s) => s.text).join(' ');
    if (!transcript.trim()) return;

    setIsClassifyingAi(true);
    try {
      const response = await fetch('/api/classify-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          language: appLang,
        }),
      });

      if (!response.ok) throw new Error('Classification failed');
      const data = await response.json();
      if (Array.isArray(data.entities)) {
        setAiClassifiedEntities(data.entities);
      }
    } catch (err) {
      console.error('AI keyword classification error:', err);
    } finally {
      setIsClassifyingAi(false);
    }
  };

  // Compute animated word items for Smart Column with dynamic keyword classification
  const { smartWordList, categoryCounts } = useMemo(() => {
    let wordCounter = 0;
    let currentSentenceIdx = 0;
    const coloredWords: {
      id: string;
      word: string;
      color: string;
      isFiller: boolean;
      isHighlighted: boolean;
      classification: KeywordClassification | null;
      isDimmed: boolean;
    }[] = [];
    const query = searchQuery.trim().toLowerCase();

    const counts: Record<KeywordCategory, number> = {
      person: 0,
      location: 0,
      organization: 0,
      tech: 0,
      datetime: 0,
      action: 0,
    };

    // Fast lookup for AI extracted multi-word or single-word entities
    const aiEntityMap = new Map<string, KeywordCategory>();
    aiClassifiedEntities.forEach((ent) => {
      const cleanEnt = normalizeWord(ent.text);
      if (cleanEnt) {
        aiEntityMap.set(cleanEnt, ent.category);
        ent.text.split(/\s+/).forEach((w) => {
          const cw = normalizeWord(w);
          if (cw.length > 2) aiEntityMap.set(cw, ent.category);
        });
      }
    });

    const processWord = (w: string) => {
      const cleanW = normalizeWord(w);
      const isSearchMatched = Boolean(query && cleanW.includes(query));

      let classification: KeywordClassification | null = null;
      if (isKeywordHighlighting) {
        const aiCategory = aiEntityMap.get(cleanW);
        if (aiCategory && KEYWORD_CATEGORIES[aiCategory]) {
          classification = KEYWORD_CATEGORIES[aiCategory];
        } else {
          classification = classifyWord(w);
        }
      }

      if (classification) {
        counts[classification.category] = (counts[classification.category] || 0) + 1;
      }

      // Check if word should be dimmed based on selected category filter
      let isDimmed = false;
      if (selectedCategoryFilter !== 'all') {
        if (!classification || classification.category !== selectedCategoryFilter) {
          isDimmed = true;
        }
      }

      const sentenceColor = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
      const finalColor = classification && !isDimmed ? classification.color : sentenceColor;

      coloredWords.push({
        id: `smart-${wordCounter++}-${w}`,
        word: w,
        color: finalColor,
        isFiller: false,
        isHighlighted: isSearchMatched,
        classification,
        isDimmed,
      });

      if (isSentenceEndingWord(w)) {
        currentSentenceIdx++;
      }
    };

    smartSegments.forEach((segment) => {
      const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
      words.forEach(processWord);
    });

    if (smartInterimText && smartInterimText.trim().length > 0) {
      const words = smartInterimText.trim().split(/\s+/).filter((w) => w.length > 0);
      words.forEach(processWord);
    }

    return { smartWordList: coloredWords, categoryCounts: counts };
  }, [
    smartSegments,
    smartInterimText,
    searchQuery,
    isKeywordHighlighting,
    selectedCategoryFilter,
    aiClassifiedEntities,
  ]);

  // Compute animated word items for Verbatim Column
  const verbatimWordList = useMemo(() => {
    let wordCounter = 0;
    let currentSentenceIdx = 0;
    const coloredWords: { id: string; word: string; color: string; isFiller: boolean; isHighlighted: boolean }[] = [];
    const query = searchQuery.trim().toLowerCase();

    verbatimSegments.forEach((segment) => {
      const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        const isFiller = isFillerWord(w);
        const isHighlighted = Boolean(query && normalizeWord(w).includes(query));
        coloredWords.push({
          id: `verbatim-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller,
          isHighlighted,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    });

    if (verbatimInterimText && verbatimInterimText.trim().length > 0) {
      const words = verbatimInterimText.trim().split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        const isFiller = isFillerWord(w);
        const isHighlighted = Boolean(query && normalizeWord(w).includes(query));
        coloredWords.push({
          id: `verbatim-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller,
          isHighlighted,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    }

    return coloredWords;
  }, [verbatimSegments, verbatimInterimText, searchQuery]);

  const copyTranscript = (mode: 'smart' | 'verbatim' | 'both') => {
    let textToCopy = '';
    const smartText = smartSegments.map((s) => s.text).join('\n');
    const verbatimText = verbatimSegments.map((s) => s.text).join('\n');

    if (mode === 'smart') {
      textToCopy = smartText;
    } else if (mode === 'verbatim') {
      textToCopy = verbatimText;
    } else {
      textToCopy = `[Smart Transcription]\n${smartText}\n\n[Verbatim Transcription]\n${verbatimText}`;
    }

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const exportTranscript = (format: 'txt' | 'srt' | 'json') => {
    const smartText = smartSegments.map((s) => s.text).join('\n');
    const verbatimText = verbatimSegments.map((s) => s.text).join('\n');

    let content = '';
    let mimeType = 'text/plain';
    let filename = `transcript_${Date.now()}`;

    if (format === 'txt') {
      content = `=== ${isArabic ? 'نسخ الصوت الذكي' : 'Smart Audio Transcription'} ===\n${smartText}\n\n=== ${isArabic ? 'النسخ الحرفي' : 'Verbatim Transcription'} ===\n${verbatimText}`;
      filename += '.txt';
    } else if (format === 'json') {
      content = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          smartSegments,
          verbatimSegments,
          analysisResult,
          fileMeta: fileTranscriptionMeta,
        },
        null,
        2
      );
      mimeType = 'application/json';
      filename += '.json';
    } else if (format === 'srt') {
      // Build basic srt format
      content = smartSegments
        .map((seg, idx) => {
          return `${idx + 1}\n00:00:${(idx * 5).toString().padStart(2, '0')},000 --> 00:00:${((idx + 1) * 5).toString().padStart(2, '0')},000\n${seg.text}\n`;
        })
        .join('\n');
      filename += '.srt';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearTranscripts = () => {
    setSmartSegments([]);
    setSmartInterimText('');
    setVerbatimSegments([]);
    setVerbatimInterimText('');
    setAnalysisResult(null);
    setFileTranscriptionMeta(null);
    setRecordingSeconds(0);
  };

  const isActive = status === 'recording' || status === 'connecting';

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Top Header Navigation */}
      <header className="shrink-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-black/80 backdrop-blur-md">
        
        {/* Brand & Tabs */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-sm tracking-tight">
              {isArabic ? 'استوديو نسخ الصوت' : 'Audio Transcribe Studio'}
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تسجيل مباشر (Live Mic)' : 'Live Mic'}</span>
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>{isArabic ? 'رفع ملف صوتي (Upload)' : 'Audio File'}</span>
            </button>
          </div>
        </div>

        {/* Status Indicator, Quick Actions & Settings */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Live Audio Meter & Indicator */}
          {status === 'recording' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>
                {isArabic ? 'مباشر' : 'LIVE'} ({Math.floor(recordingSeconds / 60)}:
                {(recordingSeconds % 60).toString().padStart(2, '0')})
              </span>
              <div className="w-10 sm:w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                />
              </div>
            </div>
          )}

          {status === 'connecting' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-950/80 border border-yellow-500/50 text-yellow-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              <span>{isArabic ? 'جارٍ الاتصال بـ Gemini...' : 'Connecting...'}</span>
            </div>
          )}

          {/* Search Box */}
          <div className="relative hidden md:block">
            <Search className={`w-3.5 h-3.5 text-white/40 absolute top-2.5 ${isArabic ? 'right-2.5' : 'left-2.5'}`} />
            <input
              type="text"
              placeholder={isArabic ? 'بحث في النص المنسوخ...' : 'Search transcript...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/40 py-1.5 focus:border-indigo-400 outline-none w-36 lg:w-48 ${
                isArabic ? 'pr-8 pl-3' : 'pl-8 pr-3'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute top-2 text-white/40 hover:text-white text-xs ${isArabic ? 'left-2' : 'right-2'}`}
              >
                ✕
              </button>
            )}
          </div>

          {/* Layout View Switcher */}
          <div className="hidden sm:flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setViewLayout('split')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                viewLayout === 'split' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
              }`}
              title={isArabic ? 'عرض متجاور' : 'Split View'}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewLayout('smart')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                viewLayout === 'smart' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
              }`}
              title={isArabic ? 'النسخ الذكي فقط' : 'Smart Only'}
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewLayout('verbatim')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                viewLayout === 'verbatim' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
              }`}
              title={isArabic ? 'النسخ الحرفي فقط' : 'Verbatim Only'}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speech Analysis Button */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={triggerSpeechAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-400/40 text-indigo-200 hover:bg-indigo-600/50 text-xs font-semibold transition-all cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تحليل الأداء' : 'Analyze'}</span>
            </button>
          )}

          {/* AI Voice Reply Button */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={() => {
                setIsVoiceReplyOpen(true);
                if (!voiceReplyText) {
                  handleTriggerVoiceReply();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/40 to-indigo-600/40 border border-purple-400/50 text-purple-200 hover:from-purple-600/60 hover:to-indigo-600/60 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title={isArabic ? 'الرد الصوتي من الذكاء الاصطناعي' : 'Gemini AI Voice Reply'}
            >
              <Bot className="w-3.5 h-3.5 text-purple-300" />
              <span>{isArabic ? 'رد صوتي' : 'Voice Reply'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          )}

          {/* Cloud Firestore Button */}
          <button
            onClick={() => setIsCloudModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title={isArabic ? 'قاعدة بيانات Firestore والسجل السحابي' : 'Cloud Firestore Database & History'}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">{isArabic ? 'السحابة' : 'Cloud'}</span>
            {savedTranscriptions.length > 0 && (
              <span className="bg-sky-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {savedTranscriptions.length}
              </span>
            )}
          </button>

          {/* Google Auth User Button */}
          {currentUser ? (
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className="flex items-center gap-2 p-1 pl-2 sm:px-2.5 sm:py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition-colors cursor-pointer"
              title={currentUser.displayName || currentUser.email || 'User'}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="hidden md:inline font-medium text-white/90 max-w-[100px] truncate">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isArabic ? 'دخول' : 'Sign In'}</span>
            </button>
          )}

          {/* Language Switcher Button */}
          <button
            onClick={() => setAppLang(appLang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-xs font-mono transition-colors cursor-pointer"
            title="Toggle Language"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span>{appLang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Setup Config Button */}
          <button
            onClick={() => setIsSetupOpen(true)}
            className="p-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
            title={isArabic ? 'إعدادات النموذج' : 'Model Setup'}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Upload Audio Tab View */}
        {activeTab === 'file' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950/60 flex flex-col">
            <AudioFileUpload
              appLang={appLang}
              onTranscriptionComplete={handleFileTranscriptionComplete}
              isTranscribing={isFileTranscribing}
              setIsTranscribing={setIsFileTranscribing}
              customVocabulary={config.customVocabulary}
            />

            {/* Summary card if file was transcribed */}
            {fileTranscriptionMeta && (
              <div className="max-w-4xl mx-auto w-full p-4 rounded-2xl bg-zinc-900 border border-indigo-500/30 mt-4 mb-2 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isArabic
                        ? `تم نسخ الملف بنجاح (${fileTranscriptionMeta.language || 'العربية'})`
                        : `Transcribed Successfully (${fileTranscriptionMeta.language || 'Audio'})`}
                    </span>
                  </div>
                  {fileTranscriptionMeta.summary && (
                    <p className="text-xs text-white/70 max-w-2xl">{fileTranscriptionMeta.summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleSaveCurrentToCloud('file')}
                    disabled={isSavingToCloud}
                    className="px-3 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/40 text-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {isSavingToCloud
                        ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...')
                        : (isArabic ? 'حفظ بالسحابة' : 'Save Cloud')}
                    </span>
                  </button>
                  <button
                    onClick={() => copyTranscript('both')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedMode === 'both' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isArabic ? 'نسخ النصين' : 'Copy Both'}</span>
                  </button>
                  <button
                    onClick={() => exportTranscript('txt')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تصدير' : 'Export'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Waveform Visualizer Banner above the transcription area */}
        <WaveformVisualizer
          analyser={analyserNode || analyserRef.current}
          isRecording={status === 'recording'}
          isMuted={isMuted}
          audioLevel={audioLevel}
          recordingSeconds={recordingSeconds}
          appLang={appLang}
        />

        {/* Dual Side-by-Side Live or Result Transcription Columns */}
        <div className={`flex-1 w-full grid overflow-hidden pb-24 ${
          viewLayout === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
        }`}>
          
          {/* VERBATIM COLUMN */}
          {(viewLayout === 'split' || viewLayout === 'verbatim') && (
            <div className={`flex flex-col h-full overflow-hidden border-white/10 px-4 sm:px-8 py-3 ${
              viewLayout === 'split' ? (isArabic ? 'md:border-l' : 'md:border-r border-b md:border-b-0') : ''
            }`}>
              {/* Column Header */}
              <div className="shrink-0 flex items-center justify-between py-2 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                    {isArabic ? 'النسخ الحرفي والدقيق (Verbatim Mode)' : 'Verbatim Mode'}
                  </h3>
                  <span className="text-[11px] text-white/40">
                    ({verbatimWordList.length} {isArabic ? 'كلمة' : 'words'})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speakText(verbatimSegments.map((s) => s.text).join(' '))}
                    disabled={verbatimSegments.length === 0}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isArabic ? 'قراءة النص الحرفي بالصوت' : 'Read Aloud'}
                  >
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  </button>
                  <button
                    onClick={() => copyTranscript('verbatim')}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title={isArabic ? 'نسخ النص الحرفي' : 'Copy Verbatim'}
                  >
                    {copiedMode === 'verbatim' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => exportTranscript('txt')}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title={isArabic ? 'تصدير النص' : 'Export'}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Transcript Scroll Area */}
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
                <div className="grow flex flex-col justify-center">
                  <div className="flex flex-wrap items-center justify-center font-sans tracking-tight text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl transition-all duration-300">
                    <AnimatePresence mode="popLayout">
                      {verbatimWordList.length === 0 ? (
                        <motion.div
                          key="verbatim-welcome"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center gap-3 text-center max-w-md mx-auto py-12"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Mic className="w-7 h-7" />
                          </div>
                          <h4 className="text-xl sm:text-2xl font-bold text-white">
                            {isArabic ? 'وضع النسخ الحرفي نشط' : 'Verbatim Mode Active'}
                          </h4>
                          <p className="text-sm text-white/50 leading-relaxed">
                            {isArabic
                              ? 'يوثق كل كلمة منطوقة وتوقفات الحديث وعلامات التردد بدقة، مع تمييز كلمات الحشو بلون خاص لقياس طلاقة وسلاسة الإلقاء.'
                              : 'Preserves every single utterance and hesitation exactly as spoken. Highlights filler words to measure communication cadence.'}
                          </p>
                        </motion.div>
                      ) : (
                        verbatimWordList.map((item) => (
                          <AnimatedWord
                            key={item.id}
                            word={item.word}
                            color={item.color}
                            isFiller={item.isFiller}
                            isHighlighted={item.isHighlighted}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div ref={leftTranscriptEndRef} className="h-16 w-full shrink-0" />
              </div>
            </div>
          )}

          {/* SMART COLUMN */}
          {(viewLayout === 'split' || viewLayout === 'smart') && (
            <div className="flex flex-col h-full overflow-hidden px-4 sm:px-8 py-3">
              {/* Column Header */}
              <div className="shrink-0 flex flex-col gap-2 py-2 border-b border-white/10 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                      {isArabic ? 'النسخ الذكي المنقح (Smart Mode)' : 'Smart Transcription'}
                    </h3>
                    <span className="text-[11px] text-white/40">
                      ({smartWordList.length} {isArabic ? 'كلمة' : 'words'})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Toggle Keyword Classification */}
                    <button
                      onClick={() => setIsKeywordHighlighting(!isKeywordHighlighting)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isKeywordHighlighting
                          ? 'bg-indigo-600/40 border border-indigo-400/50 text-indigo-200'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:text-white'
                      }`}
                      title={isArabic ? 'تفعيل/تعطيل تلوين وتصنيف الكلمات المفتاحية' : 'Toggle Keyword Classification'}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'تصنيف الكلمات' : 'Keywords'}</span>
                    </button>

                    {/* AI Entity Extraction via Gemini */}
                    {smartSegments.length > 0 && (
                      <button
                        onClick={triggerAiKeywordExtraction}
                        disabled={isClassifyingAi}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/30 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-600/50 text-xs font-semibold transition-all cursor-pointer"
                        title={isArabic ? 'استخراج وتحليل الكيانات والمواضيع بـ Gemini' : 'Extract Entities with Gemini AI'}
                      >
                        {isClassifyingAi ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span className="hidden sm:inline">
                          {isArabic ? 'تحليل الكيانات بـ Gemini' : 'AI Extract'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => speakText(smartSegments.map((s) => s.text).join(' '))}
                      disabled={smartSegments.length === 0}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isArabic ? 'قراءة النص الذكي بالصوت' : 'Read Aloud'}
                    >
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                    </button>
                    <button
                      onClick={() => copyTranscript('smart')}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                      title={isArabic ? 'نسخ النص الذكي' : 'Copy Smart'}
                    >
                      {copiedMode === 'smart' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => exportTranscript('txt')}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                      title={isArabic ? 'تصدير' : 'Export'}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Topic / Entity Categories Legend & Filter Bar */}
                {isKeywordHighlighting && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-[11px] font-medium no-scrollbar">
                    <span className="text-white/40 text-[10px] shrink-0 mr-1 flex items-center gap-1">
                      <Filter className="w-3 h-3" />
                      <span>{isArabic ? 'التصنيف:' : 'Filter:'}</span>
                    </span>

                    {/* All Filter */}
                    <button
                      onClick={() => setSelectedCategoryFilter('all')}
                      className={`px-2 py-0.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                        selectedCategoryFilter === 'all'
                          ? 'bg-white text-black font-bold border-white'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {isArabic ? 'الكل' : 'All'}
                    </button>

                    {/* Category Filter Pills */}
                    {(
                      [
                        { cat: 'person' as KeywordCategory, label: isArabic ? '👤 أشخاص' : '👤 People', color: '#38bdf8' },
                        { cat: 'location' as KeywordCategory, label: isArabic ? '📍 أماكن' : '📍 Places', color: '#34d399' },
                        { cat: 'organization' as KeywordCategory, label: isArabic ? '🏢 مؤسسات' : '🏢 Orgs', color: '#c084fc' },
                        { cat: 'tech' as KeywordCategory, label: isArabic ? '💻 تقنية' : '💻 Tech', color: '#2dd4bf' },
                        { cat: 'datetime' as KeywordCategory, label: isArabic ? '📅 أرقام وتواريخ' : '📅 Dates/Nums', color: '#fbbf24' },
                        { cat: 'action' as KeywordCategory, label: isArabic ? '⚡ قرارات ومهام' : '⚡ Actions', color: '#f43f5e' },
                      ]
                    ).map(({ cat, label, color }) => {
                      const count = categoryCounts[cat] || 0;
                      const isSelected = selectedCategoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategoryFilter(isSelected ? 'all' : cat)}
                          className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-white/20 border-white text-white font-bold ring-1 ring-white/30'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                          style={{
                            borderColor: isSelected ? color : undefined,
                            boxShadow: isSelected ? `0 0 10px ${color}33` : undefined,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span>{label}</span>
                          {count > 0 && (
                            <span className="px-1 py-0.2 rounded-full bg-black/40 text-[9px] font-mono text-white/90">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Transcript Scroll Area */}
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
                <div className="grow flex flex-col justify-center">
                  <div className="flex flex-wrap items-center justify-center font-sans tracking-tight text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl transition-all duration-300">
                    <AnimatePresence mode="popLayout">
                      {smartWordList.length === 0 ? (
                        <motion.div
                          key="smart-welcome"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center gap-3 text-center max-w-md mx-auto py-12"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Wand2 className="w-7 h-7" />
                          </div>
                          <h4 className="text-xl sm:text-2xl font-bold text-white">
                            {isArabic ? 'النسخ الذكي الفوري نشط' : 'Smart Transcription Active'}
                          </h4>
                          <p className="text-sm text-white/50 leading-relaxed">
                            {isArabic
                              ? 'يقوم بتنقية الحديث وإزالة كلمات الحشو، مع التصنيف التلقائي للكلمات المفتاحية والمواضيع (أشخاص، أماكن، مؤسسات، تقنية، ومواعيد).'
                              : 'Remove filler words with automatic dynamic keyword classification for people, places, organizations, technologies, and dates.'}
                          </p>
                        </motion.div>
                      ) : (
                        smartWordList.map((item) => (
                          <AnimatedWord
                            key={item.id}
                            word={item.word}
                            color={item.color}
                            isFiller={false}
                            isHighlighted={item.isHighlighted}
                            classification={item.classification}
                            showCategoryBadge={isKeywordHighlighting}
                            isDimmed={item.isDimmed}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div ref={rightTranscriptEndRef} className="h-16 w-full shrink-0" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-3 sm:gap-4 z-40 pointer-events-none px-4">
        <div className="flex items-center gap-3 sm:gap-4 p-2 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-xl shadow-2xl pointer-events-auto">
          {/* Start Recording / Play */}
          <button
            onClick={startRecording}
            disabled={isActive}
            className={`w-12 sm:w-14 h-12 sm:h-14 rounded-xl flex items-center justify-center transition-all ${
              isActive
                ? 'opacity-40 cursor-not-allowed bg-white/10'
                : 'bg-white text-black hover:bg-gray-200 shadow-lg cursor-pointer'
            }`}
            title={isArabic ? 'بدء التسجيل الصوتي المباشر' : 'Start Live Dual Recording'}
          >
            <Play className="w-6 sm:w-7 h-6 sm:h-7 fill-current" />
          </button>

          {/* Mute / Unmute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            disabled={!isActive}
            className={`w-12 sm:w-14 h-12 sm:h-14 rounded-xl border flex items-center justify-center transition-colors ${
              !isActive
                ? 'opacity-30 border-white/20 cursor-not-allowed'
                : isMuted
                ? 'border-red-500 bg-red-950/60 text-red-400 hover:bg-red-900/60 cursor-pointer'
                : 'border-white/30 hover:bg-white/10 text-white cursor-pointer'
            }`}
            title={isMuted ? (isArabic ? 'إلغاء الكتم' : 'Unmute') : (isArabic ? 'كتم الميكروفون' : 'Mute')}
          >
            <Pause className="w-6 h-6" />
          </button>

          {/* Stop Recording */}
          <button
            onClick={stopAudio}
            disabled={!isActive}
            className={`w-12 sm:w-14 h-12 sm:h-14 rounded-xl border flex items-center justify-center transition-colors ${
              !isActive
                ? 'opacity-30 border-white/20 cursor-not-allowed'
                : 'border-red-500 bg-red-600 text-white hover:bg-red-700 shadow-lg cursor-pointer'
            }`}
            title={isArabic ? 'إيقاف التسجيل' : 'Stop & Finalize'}
          >
            <Square className="w-6 h-6 fill-current" />
          </button>

          {/* Clear Transcripts */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={clearTranscripts}
              className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              title={isArabic ? 'مسح النص وبدء جلسة جديدة' : 'Clear transcripts'}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          {/* Analyze Speech Button in Bar */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={triggerSpeechAnalysis}
              disabled={isAnalyzing}
              className="px-4 h-12 sm:h-14 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
              title={isArabic ? 'تحليل الأداء الصوتي والخطابة' : 'Analyze Speech'}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">{isArabic ? 'تحليل الأداء' : 'Analyze'}</span>
            </button>
          )}

          {/* AI Voice Reply Button in Bar */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={handleTriggerVoiceReply}
              disabled={isVoiceReplyLoading}
              className="px-4 h-12 sm:h-14 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
              title={isArabic ? 'طلب رد صوتي من الذكاء الاصطناعي' : 'AI Voice Reply'}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">{isArabic ? 'رد بالصوت' : 'Voice Reply'}</span>
            </button>
          )}

          {/* Save to Cloud Button in Bar */}
          {(verbatimSegments.length > 0 || smartSegments.length > 0) && (
            <button
              onClick={() => handleSaveCurrentToCloud('live')}
              disabled={isSavingToCloud}
              className="px-4 h-12 sm:h-14 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/40 text-sky-200 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
              title={isArabic ? 'حفظ في قاعدة بيانات Firestore السحابية' : 'Save to Cloud Firestore'}
            >
              <Save className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">
                {isSavingToCloud
                  ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...')
                  : (isArabic ? 'حفظ بالسحابة' : 'Save Cloud')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Cloud Toast Notification */}
      <AnimatePresence>
        {cloudToastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className={`fixed bottom-24 ${isArabic ? 'right-6' : 'left-6'} z-50 px-4 py-2.5 rounded-2xl bg-sky-950/95 border border-sky-500/50 text-sky-200 text-xs shadow-2xl flex items-center gap-2 backdrop-blur-md`}
          >
            <Cloud className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>{cloudToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-16 z-50 self-center rounded-2xl border border-red-500 bg-red-950/95 px-6 py-4 font-sans text-sm text-red-200 shadow-2xl max-w-lg text-center"
          >
            <div className="font-bold mb-1">
              {isArabic ? 'تنبيه:' : 'ERROR:'} {errorMessage}
            </div>
            {errorMessage.includes('Microphone') || errorMessage.includes('الميكروفون') ? (
              <p className="text-xs text-red-300 mt-2">
                {isArabic
                  ? 'يرجى التأكد من منح الإذن للميكروفون في المتصفح أو فتح التطبيق في نافذة مستقلة.'
                  : 'Ensure microphone permissions are granted in your browser.'}
              </p>
            ) : null}
            <button
              onClick={() => setErrorMessage(null)}
              className="absolute top-3 left-3 text-red-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Setup Modal */}
      <SetupPanel
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        config={config}
        onSaveConfig={setConfig}
        appLang={appLang}
      />

      {/* Speech Analysis Modal */}
      <AnalysisModal
        isAnalyzing={isAnalyzing}
        analysisResult={analysisResult}
        onClose={() => setIsAnalysisModalOpen(false)}
        paceMode={paceMode}
        setPaceMode={setPaceMode}
        totalWords={verbatimWordList.length}
        fillerCount={analysisResult?.fillerWordsCount || verbatimWordList.filter((w) => w.isFiller).length}
        netWords={
          verbatimWordList.length -
          (analysisResult?.fillerWordsCount || verbatimWordList.filter((w) => w.isFiller).length)
        }
        speechDurationSeconds={recordingSeconds || 30}
        grossPaceWpm={analysisResult?.grossWpm || Math.round((verbatimWordList.length / Math.max(1, recordingSeconds || 30)) * 60)}
        netPaceWpm={analysisResult?.netWpm || Math.round(((verbatimWordList.length - verbatimWordList.filter((w) => w.isFiller).length) / Math.max(1, recordingSeconds || 30)) * 60)}
        currentPaceWpm={
          paceMode === 'gross'
            ? analysisResult?.grossWpm || Math.round((verbatimWordList.length / Math.max(1, recordingSeconds || 30)) * 60)
            : analysisResult?.netWpm || Math.round(((verbatimWordList.length - verbatimWordList.filter((w) => w.isFiller).length) / Math.max(1, recordingSeconds || 30)) * 60)
        }
        pacePercentage={100}
        fillerPercentage={
          verbatimWordList.length > 0
            ? Math.round(
                ((analysisResult?.fillerWordsCount || verbatimWordList.filter((w) => w.isFiller).length) /
                  verbatimWordList.length) *
                  100
              )
            : 0
        }
        appLang={appLang}
      />

      {/* AI Voice Reply Panel */}
      <VoiceReplyPanel
        isOpen={isVoiceReplyOpen}
        onClose={() => setIsVoiceReplyOpen(false)}
        replyText={voiceReplyText}
        audioBase64={voiceReplyAudioBase64}
        isLoading={isVoiceReplyLoading}
        appLang={appLang}
        selectedVoice={selectedVoice}
        onSelectVoice={setSelectedVoice}
        onTriggerReply={handleTriggerVoiceReply}
        hasTranscript={Boolean(smartSegments.length > 0 || verbatimSegments.length > 0)}
        autoVoiceReply={autoVoiceReply}
        onToggleAutoVoiceReply={setAutoVoiceReply}
      />

      {/* Cloud Firestore History Modal */}
      <CloudHistoryModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentUser={currentUser}
        savedTranscriptions={savedTranscriptions}
        isLoading={isCloudLoading}
        onRefresh={() => fetchCloudTranscriptions(currentUser?.uid)}
        onLoadIntoEditor={handleLoadSavedIntoEditor}
        onDelete={handleDeleteCloudItem}
        appLang={appLang}
        onSignIn={signInWithGoogle}
        onSignOut={logOut}
      />
    </div>
  );
}

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Bot,
  X,
  Mic,
  Settings2,
  Radio
} from 'lucide-react';
import { AppLanguage } from '../types';

interface VoiceReplyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  replyText: string | null;
  audioBase64: string | null;
  isLoading: boolean;
  appLang: AppLanguage;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
  onTriggerReply: () => void;
  hasTranscript: boolean;
  autoVoiceReply: boolean;
  onToggleAutoVoiceReply: (enabled: boolean) => void;
}

const VOICES = [
  { id: 'Kore', labelAr: 'كوري (متزن ودافئ)', labelEn: 'Kore (Balanced & Warm)' },
  { id: 'Puck', labelAr: 'باك (حيوي ومرح)', labelEn: 'Puck (Lively)' },
  { id: 'Charon', labelAr: 'شارون (عميق ورخيم)', labelEn: 'Charon (Deep & Resonant)' },
  { id: 'Fenrir', labelAr: 'فنرير (واثق وهادئ)', labelEn: 'Fenrir (Confident)' },
  { id: 'Zephyr', labelAr: 'زفير (سريع وسلس)', labelEn: 'Zephyr (Smooth & Fast)' },
];

export const VoiceReplyPanel: React.FC<VoiceReplyPanelProps> = ({
  isOpen,
  onClose,
  replyText,
  audioBase64,
  isLoading,
  appLang,
  selectedVoice,
  onSelectVoice,
  onTriggerReply,
  hasTranscript,
  autoVoiceReply,
  onToggleAutoVoiceReply,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isArabic = appLang === 'ar';

  // Automatically play when new audio arrives
  useEffect(() => {
    if (audioBase64) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onloadedmetadata = () => setDuration(audio.duration);

      audio.play().catch((err) => {
        console.warn('Auto-play blocked by browser, user can click play:', err);
      });
    } else if (replyText && !audioBase64 && !isLoading) {
      // Fallback: Web Speech API synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.lang = isArabic ? 'ar-SA' : 'en-US';
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioBase64, replyText, isLoading, isArabic]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else if (replyText && 'speechSynthesis' in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.lang = isArabic ? 'ar-SA' : 'en-US';
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const replay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    } else if (replyText && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(replyText);
      utterance.lang = isArabic ? 'ar-SA' : 'en-US';
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.96 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        className="fixed bottom-24 right-4 sm:right-8 z-50 w-[92vw] sm:w-[480px] rounded-3xl border border-indigo-500/40 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-5 text-white flex flex-col gap-4 overflow-hidden"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Glow Background */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>{isArabic ? 'الرد الصوتي من الذكاء الاصطناعي' : 'Gemini AI Voice Reply'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-white/50">
                {isArabic ? 'استماع وتفاعل بالصوت الطبيعي مع Gemini TTS' : 'Interactive audio response powered by Gemini TTS'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-full border-3 border-indigo-500 border-t-transparent"
            />
            <p className="text-xs font-semibold text-white/80">
              {isArabic ? 'جارٍ توليد الرد الصوتي بالذكاء الاصطناعي...' : 'Synthesizing voice response with Gemini...'}
            </p>
          </div>
        )}

        {/* Reply Body */}
        {!isLoading && replyText && (
          <div className="space-y-3 relative z-10">
            {/* AI Speech Bubble */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm leading-relaxed text-white/90">
              {replyText}
            </div>

            {/* Audio Wave & Playback Bar */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/60 border border-white/10">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 flex items-center justify-center text-white transition-all shadow-md cursor-pointer shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
              </button>

              <button
                onClick={replay}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                title={isArabic ? 'إعادة الاستماع' : 'Replay'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Animated Speaking Sound Wave Bars */}
              <div className="flex-1 flex items-center gap-1 h-6 px-2">
                {[40, 75, 55, 90, 60, 80, 45, 95, 70, 50, 85, 65, 40, 70, 90, 50].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={isPlaying ? { height: [`${Math.max(15, h * 0.3)}%`, `${h}%`, `${Math.max(15, h * 0.2)}%`] } : { height: '25%' }}
                    transition={{ repeat: Infinity, duration: 0.6 + (i % 4) * 0.1, ease: 'easeInOut' }}
                    className={`flex-1 rounded-full ${isPlaying ? 'bg-indigo-400' : 'bg-white/20'}`}
                  />
                ))}
              </div>

              <div className="text-[11px] font-mono text-white/50 shrink-0">
                {isPlaying ? (isArabic ? 'جارٍ التحدث...' : 'Speaking...') : (isArabic ? 'جاهز' : 'Ready')}
              </div>
            </div>
          </div>
        )}

        {/* Empty / Initial State */}
        {!isLoading && !replyText && (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-center text-white/60">
            <Sparkles className="w-8 h-8 text-indigo-400" />
            <p className="text-xs">
              {isArabic
                ? 'تحدث في الميكروفون ثم اضغط على "طلب رد صوتي" للرد عليك بالصوت مباشرة.'
                : 'Speak into the mic, then click Voice Reply to have the AI answer aloud.'}
            </p>
          </div>
        )}

        {/* Voice Persona Selector & Auto-Reply Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
          {/* Voice Persona */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/50">{isArabic ? 'الصوت:' : 'Voice:'}</span>
            <select
              value={selectedVoice}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="bg-black border border-white/20 text-white text-[11px] rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {isArabic ? v.labelAr : v.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Action Button: Generate / Regenerate */}
          <button
            onClick={onTriggerReply}
            disabled={isLoading || !hasTranscript}
            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer ${
              isLoading || !hasTranscript ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isArabic ? 'طلب رد صوتي الآن' : 'Get Voice Reply'}</span>
          </button>
        </div>

        {/* Auto Voice Reply Checkbox */}
        <div className="flex items-center justify-between text-[11px] text-white/60 bg-white/5 px-3 py-2 rounded-xl">
          <span>{isArabic ? 'الرد الصوتي تلقائياً عند انتهاء التسجيل:' : 'Auto voice reply on stop:'}</span>
          <button
            onClick={() => onToggleAutoVoiceReply(!autoVoiceReply)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
              autoVoiceReply ? 'bg-indigo-600 justify-end' : 'bg-white/20 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

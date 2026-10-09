import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileAudio, Play, Pause, RefreshCw, Sparkles, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react';
import { AppLanguage, FileTranscriptionResult } from '../types';

interface AudioFileUploadProps {
  appLang: AppLanguage;
  onTranscriptionComplete: (result: FileTranscriptionResult) => void;
  isTranscribing: boolean;
  setIsTranscribing: (val: boolean) => void;
  customVocabulary: string[];
}

export const AudioFileUpload: React.FC<AudioFileUploadProps> = ({
  appLang,
  onTranscriptionComplete,
  isTranscribing,
  setIsTranscribing,
  customVocabulary,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [targetLang, setTargetLang] = useState<string>('ar');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isArabic = appLang === 'ar';

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('audio/') && !selectedFile.name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
      setErrorMessage(
        isArabic
          ? 'يرجى اختيار ملف صوتي صالح (MP3, WAV, M4A, OGG, WEBM)'
          : 'Please select a valid audio file (MP3, WAV, M4A, OGG, WEBM)'
      );
      return;
    }

    // Limit to 25MB for browser payload
    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMessage(
        isArabic
          ? 'حجم الملف كبير جداً. الحد الأقصى المسموح به هو 25 ميجابايت.'
          : 'File size too large. Maximum allowed size is 25MB.'
      );
      return;
    }

    setErrorMessage(null);
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const audioBase64 = await base64Promise;

      const response = await fetch('/api/transcribe-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          audioMimeType: file.type || 'audio/mp3',
          language: targetLang,
          customVocabulary,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || (isArabic ? 'فشل نسخ الملف الصوتي' : 'Failed to transcribe audio'));
      }

      const data: FileTranscriptionResult = await response.json();
      onTranscriptionComplete(data);
    } catch (err: unknown) {
      console.error('Transcription error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Provide a sample audio option
  const loadArabicSampleAudio = async () => {
    try {
      setIsTranscribing(true);
      setErrorMessage(null);

      // Create a short synthesized Arabic audio tone or fetch
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AudioContextClass();
      const sampleRate = actx.sampleRate;
      const seconds = 3;
      const buffer = actx.createBuffer(1, sampleRate * seconds, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        // Melodic sound
        data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * Math.exp(-i / (sampleRate * 1.5)) * 0.2;
      }

      // Convert to wav
      const wavBytes = encodeWAV(data, sampleRate);
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const sampleFile = new File([blob], 'arabic_sample_speech.wav', { type: 'audio/wav' });
      handleFileSelect(sampleFile);

      // Immediately provide sample transcription demo to make user testing instant
      setTimeout(() => {
        onTranscriptionComplete({
          smart: 'مرحباً بكم في منصة نسخ الصوت الذكية. تم تحويل هذا التسجيل الصوتي بنجاح مع تنقيح العبارات وضبط علامات الترقيم تلقائياً وبدقة فائقة.',
          verbatim: 'أه مرحباً بكم يعني في منصة نسخ الصوت الذكية. أمم تم تحويل هذا التسجيل الصوتي بنجاح مع يعني تنقيح العبارات وضبط علامات الترقيم تلقائياً.',
          language: 'العربية (Arabic)',
          fillerWords: ['أه', 'يعني', 'أمم'],
          summary: 'مقدمة ترحيبية وتوضيح لقدرات نسخ الصوت الذكي والحرفي باللغة العربية.',
        });
        setIsTranscribing(false);
      }, 900);
    } catch (e) {
      console.error(e);
      setIsTranscribing(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/[0.07]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
          <Upload className="w-8 h-8 text-indigo-400" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            {isArabic ? 'اسحب وأفلت الملف الصوتي هنا أو انقر للاختيار' : 'Drag & drop your audio file here or browse'}
          </h3>
          <p className="text-sm text-white/50">
            {isArabic
              ? 'يدعم صيغ MP3, WAV, M4A, OGG, WEBM, FLAC حتى 25 ميجابايت'
              : 'Supports MP3, WAV, M4A, OGG, WEBM, FLAC up to 25MB'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {['MP3', 'WAV', 'M4A', 'OGG', 'WEBM'].map((ext) => (
            <span
              key={ext}
              className="px-2.5 py-0.5 rounded-md bg-white/10 text-white/70 text-xs font-mono font-medium"
            >
              .{ext}
            </span>
          ))}
        </div>
      </div>

      {/* Selected File & Audio Player */}
      {file && audioUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-zinc-900 border border-white/15 p-5 space-y-4 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <FileAudio className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white max-w-xs sm:max-w-md truncate">{file.name}</div>
                <div className="text-xs text-white/50 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; {duration ? formatSeconds(duration) : '--:--'}
                </div>
              </div>
            </div>

            {/* Language Selector for transcription */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">{isArabic ? 'لغة الصوت:' : 'Audio Language:'}</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-black border border-white/20 text-white text-xs rounded-lg px-3 py-1.5 focus:border-indigo-400 outline-none"
              >
                <option value="ar">{isArabic ? 'العربية (Arabic)' : 'Arabic'}</option>
                <option value="en">{isArabic ? 'الإنجليزية (English)' : 'English'}</option>
                <option value="auto">{isArabic ? 'كشف تلقائي (Auto-Detect)' : 'Auto-Detect'}</option>
                <option value="fr">{isArabic ? 'الفرنسية (French)' : 'French'}</option>
              </select>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center gap-4 bg-black/40 rounded-xl p-3 border border-white/10">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const newTime = Number(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);
                  }
                }}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-400"
              />
              <div className="flex justify-between text-[11px] font-mono text-white/50">
                <span>{formatSeconds(currentTime)}</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={() => {
                setFile(null);
                setAudioUrl(null);
                setIsPlaying(false);
              }}
              disabled={isTranscribing}
              className="px-4 py-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isArabic ? 'إلغاء الملف' : 'Remove File'}
            </button>

            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer ${
                isTranscribing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isTranscribing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isArabic ? 'جارٍ نسخ الصوت بالذكاء الاصطناعي...' : 'Transcribing with Gemini...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isArabic ? 'بدء نسخ الصوت الآن' : 'Start Transcription'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Sample Demo Section */}
      {!file && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            <span>
              {isArabic
                ? 'ليس لديك ملف صوتي جاهز؟ يمكنك تجربة عينة صوتية باللغة العربية فوراً:'
                : "Don't have an audio file ready? Try a sample transcription demo:"}
            </span>
          </div>
          <button
            onClick={loadArabicSampleAudio}
            disabled={isTranscribing}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isArabic ? 'تجربة عينة صوتية' : 'Test Sample Audio'}</span>
          </button>
        </div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper to encode simple float32 PCM array into WAV bytes
function encodeWAV(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // float to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

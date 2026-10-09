import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Award, Gauge, AlertCircle, Sparkles, CheckCircle2, TrendingUp, X } from 'lucide-react';
import { AnalysisResult, AppLanguage } from '../types';

interface AnalysisModalProps {
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  onClose: () => void;
  paceMode: 'gross' | 'net';
  setPaceMode: (mode: 'gross' | 'net') => void;
  totalWords: number;
  fillerCount: number;
  netWords: number;
  speechDurationSeconds: number;
  grossPaceWpm: number;
  netPaceWpm: number;
  currentPaceWpm: number;
  pacePercentage: number;
  fillerPercentage: number;
  appLang: AppLanguage;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isAnalyzing,
  analysisResult,
  onClose,
  paceMode,
  setPaceMode,
  totalWords,
  fillerCount,
  netWords,
  speechDurationSeconds,
  grossPaceWpm,
  netPaceWpm,
  currentPaceWpm,
  appLang,
}) => {
  if (!isAnalyzing && !analysisResult) return null;

  const isArabic = appLang === 'ar';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto bg-black/95 backdrop-blur-2xl border-t border-white/20 p-4 sm:p-8"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {isArabic ? 'تحليل الأداء الصوتي والخطابة' : 'Speech Analysis & Coaching'}
                </h2>
                <p className="text-xs text-white/60">
                  {isArabic
                    ? 'تقييم شامل لسرعة الإلقاء، كلمات الحشو، وسلامة التعبير بواسطة Gemini'
                    : 'Benchmarked against speech and communication standards'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>{isArabic ? 'إغلاق والعودة' : 'Close & Resume'}</span>
            </button>
          </div>

          {isAnalyzing ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent flex items-center justify-center"
              />
              <p className="text-lg font-medium text-white/80">
                {isArabic
                  ? 'جارٍ تحليل التسجيل الصوتي واستخراج الإحصائيات بالذكاء الاصطناعي...'
                  : 'Analyzing your speech performance with Gemini...'}
              </p>
              <p className="text-xs text-white/50">
                {isArabic ? 'حساب معدل الكلمات، كلمات الحشو، وسلامة العبارات' : 'Calculating WPM, filler word density & coherence'}
              </p>
            </div>
          ) : analysisResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Benchmark Score Card */}
              <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>{isArabic ? 'درجة التقييم الشاملة' : 'Benchmark Score'}</span>
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                    {analysisResult.overallScore >= 80
                      ? (isArabic ? 'إلقاء متميز' : 'Proficient')
                      : (isArabic ? 'جيد - قابل للتطوير' : 'Developing')}
                  </span>
                </div>
                
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl sm:text-6xl font-bold tracking-tight text-white">
                        {analysisResult.overallScore || 0}
                      </span>
                      <span className="text-xl font-bold text-white/60">/100</span>
                    </div>
                    <p className="text-white/60 text-xs mt-2">
                      {isArabic ? 'بناءً على التناغم الصوتي وخلو الحديث من التردد' : 'Based on cadence, pauses and fluency'}
                    </p>
                  </div>
                  <div className="w-28 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: analysisResult.overallScore || 0 },
                            { value: 100 - (analysisResult.overallScore || 0) },
                          ]}
                          cx="50%"
                          cy="100%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={24}
                          outerRadius={36}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#6366f1" />
                          <Cell fill="#27272a" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Speaking Pace Card */}
              <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-emerald-400" />
                    <span>{isArabic ? 'سرعة التحدث والإلقاء' : 'Speaking Pace'}</span>
                  </span>
                  <div className="flex gap-1 bg-black/50 p-0.5 rounded-lg border border-white/10">
                    <button
                      onClick={() => setPaceMode('gross')}
                      className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors ${
                        paceMode === 'gross' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {isArabic ? 'الإجمالي' : 'Gross'}
                    </button>
                    <button
                      onClick={() => setPaceMode('net')}
                      className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors ${
                        paceMode === 'net' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {isArabic ? 'الصافي' : 'Net'}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                      {currentPaceWpm}
                    </span>
                    <span className="text-sm font-semibold text-white/60">
                      {isArabic ? 'كلمة في الدقيقة (WPM)' : `WPM (${paceMode.toUpperCase()})`}
                    </span>
                  </div>
                  <p className="text-white/70 text-xs mt-2 leading-relaxed">
                    {analysisResult.speakingPaceFeedback}
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs text-white/50 border-t border-white/10 pt-3 mt-3">
                  <span>{isArabic ? `الإجمالي: ${grossPaceWpm} ك/د` : `Gross: ${grossPaceWpm} WPM`}</span>
                  <span>{isArabic ? `الصافي: ${netPaceWpm} ك/د` : `Net: ${netPaceWpm} WPM`}</span>
                </div>
              </div>

              {/* Filler Words Card */}
              <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span>{isArabic ? 'كلمات الحشو والتردد المكتشفة' : 'Filler Words Detected'}</span>
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    {fillerCount} {isArabic ? 'كلمة' : 'words'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-4xl font-bold text-white">{fillerCount}</span>
                  <span className="text-sm text-white/60">
                    {isArabic
                      ? `من إجمالي ${totalWords} كلمة (${totalWords > 0 ? Math.round((fillerCount / totalWords) * 100) : 0}%)`
                      : `out of ${totalWords} words`}
                  </span>
                </div>

                {analysisResult.fillerWordsBreakdown && analysisResult.fillerWordsBreakdown.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {analysisResult.fillerWordsBreakdown.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-200"
                      >
                        &quot;{item.word}&quot; &times; {item.count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400/90 mt-3">
                    {isArabic ? 'حديث نقي ومباشر بدون كلمات حشو ملحوظة!' : 'Clean speech with minimal filler words!'}
                  </p>
                )}

                {analysisResult.fillerWordsRetentionExplanation && (
                  <p className="text-[11px] text-white/40 mt-3 pt-3 border-t border-white/10">
                    {analysisResult.fillerWordsRetentionExplanation}
                  </p>
                )}
              </div>

              {/* Feedback Summary */}
              <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                <div>
                  <span className="font-bold text-base text-white flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <span>{isArabic ? 'التقييم الشامل والإرشادات' : 'Overall Coaching Feedback'}</span>
                  </span>
                  <p className="text-white/80 text-xs sm:text-sm leading-relaxed mt-2">
                    {analysisResult.overallFeedback}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2 text-xs">
                  {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                    <div className="flex items-start gap-1.5 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      <div>
                        <strong className="text-white">{isArabic ? 'نقاط القوة: ' : 'Strengths: '}</strong>
                        {analysisResult.strengths.join(' &bull; ')}
                      </div>
                    </div>
                  )}
                  {analysisResult.areasForImprovement && analysisResult.areasForImprovement.length > 0 && (
                    <div className="flex items-start gap-1.5 text-amber-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <strong className="text-white">{isArabic ? 'مجالات التحسين: ' : 'To Improve: '}</strong>
                        {analysisResult.areasForImprovement.join(' &bull; ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

import React, { useState } from 'react';
import { X, Plus, Trash2, Code2, Sparkles, Languages, Check, Info, BookOpen } from 'lucide-react';
import { SetupConfig, AppLanguage } from '../types';

interface SetupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: SetupConfig;
  onSaveConfig: (newConfig: SetupConfig) => void;
  appLang: AppLanguage;
}

const ARABIC_SUGGESTIONS = ['يعني', 'أم', 'أه', 'مثلاً', 'أصلاً', 'بصراحة', 'تمام', 'طيب'];
const ENGLISH_SUGGESTIONS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually'];

export const SetupPanel: React.FC<SetupPanelProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  appLang,
}) => {
  const [phrases, setPhrases] = useState<string[]>(config.customVocabulary);
  const [newPhrase, setNewPhrase] = useState('');
  const [languages, setLanguages] = useState<string[]>(config.languageCodes);
  const [newLanguage, setNewLanguage] = useState('');
  const [model, setModel] = useState(config.model);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const isArabic = appLang === 'ar';

  const handleAddPhrase = () => {
    if (newPhrase.trim() && !phrases.includes(newPhrase.trim())) {
      setPhrases([...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  };

  const handleAddSpecificPhrase = (phrase: string) => {
    if (!phrases.includes(phrase)) {
      setPhrases([...phrases, phrase]);
    }
  };

  const handleRemovePhrase = (phraseToRemove: string) => {
    setPhrases(phrases.filter((p) => p !== phraseToRemove));
  };

  const handleAddLanguage = () => {
    if (newLanguage.trim() && !languages.includes(newLanguage.trim())) {
      setLanguages([...languages, newLanguage.trim()]);
      setNewLanguage('');
    }
  };

  const handleAddSpecificLanguage = (code: string) => {
    if (!languages.includes(code)) {
      setLanguages([...languages, code]);
    }
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    setLanguages(languages.filter((l) => l !== langToRemove));
  };

  const handleSave = () => {
    onSaveConfig({
      model,
      customVocabulary: phrases,
      languageCodes: languages,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const sessionSetupPayload = {
    setup: {
      model: model,
      generationConfig: {
        responseModalities: ["TEXT"]
      },
      inputAudioTranscription: {
        mode: "SMART (and VERBATIM simultaneously)",
        ...(languages.length > 0 ? { languageCodes: languages } : {}),
        ...(phrases.length > 0 ? { customVocabulary: phrases } : {}),
      },
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-white/20 bg-zinc-950 rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                {isArabic ? 'إعدادات النسخ الصوتي ونموذج الذكاء الاصطناعي' : 'Transcription & Model Setup'}
              </h2>
              <p className="font-mono text-[11px] text-white/50">
                {isArabic ? 'تخصيص المفردات ولغات التعرف ومحددات النموذج' : 'sessionSetupMessage.setup payload constructor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-white/20 rounded-lg bg-black text-white transition-colors hover:bg-white/10 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-black/50 p-6 space-y-6 text-white">
          {/* Model Selection */}
          <div>
            <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-white/70">
              {isArabic ? 'معرّف نموذج النسخ المباشر (Model ID)' : 'Live Model ID'}
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border border-white/20 rounded-lg bg-black px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Language Hints */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white/70">
                <Languages className="h-4 w-4 text-indigo-400" />
                <span>{isArabic ? 'أكواد اللغات المستهدفة (Language Codes)' : 'Target Language Codes (Optional)'}</span>
              </label>
              <span className="font-mono text-[10px] text-white/40">language_codes</span>
            </div>
            <p className="mb-3 text-xs text-white/50 leading-relaxed">
              {isArabic
                ? 'حدد لغات التعرف على الصوت. إذا تركت فارغة، يتم الكشف التلقائي عن اللغة.'
                : 'Define spoken languages for recognition. Empty enables auto-detection.'}
            </p>

            {/* Quick Language Add Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px] text-white/40 mr-1">{isArabic ? 'إضافة سريعة:' : 'Quick add:'}</span>
              {[
                { label: 'العربية (ar)', code: 'ar' },
                { label: 'العربية - السعودية (ar-SA)', code: 'ar-SA' },
                { label: 'العربية - مصر (ar-EG)', code: 'ar-EG' },
                { label: 'English (US)', code: 'en-US' },
                { label: 'English (GB)', code: 'en-GB' },
                { label: 'Français (fr-FR)', code: 'fr-FR' },
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleAddSpecificLanguage(item.code)}
                  className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-colors ${
                    languages.includes(item.code)
                      ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  +{item.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder={isArabic ? 'مثال: ar, ar-SA, en-US...' : 'e.g. ar, en-US, de-DE...'}
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
                className="flex-1 border border-white/20 rounded-lg bg-black px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleAddLanguage}
                className="flex items-center gap-1 border border-white/30 rounded-lg bg-white/10 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isArabic ? 'إضافة' : 'Add'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {languages.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 border border-indigo-500/40 bg-indigo-500/10 rounded-lg px-2.5 py-1 font-mono text-xs font-bold text-indigo-200"
                >
                  <span>{code}</span>
                  <button
                    onClick={() => handleRemoveLanguage(code)}
                    className="text-white/40 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {languages.length === 0 && (
                <p className="font-mono text-xs italic text-white/40">
                  {isArabic ? 'الكشف التلقائي عن اللغة مفعّل حالياً.' : 'Automatic language detection enabled.'}
                </p>
              )}
            </div>
          </div>

          {/* Custom Vocabulary / Adaptation Phrases */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-emerald-400" />
                <span>{isArabic ? 'قاموس المفردات المخصصة وكلمات الحشو' : 'Custom Vocabulary & Bias'}</span>
              </label>
              <span className="font-mono text-[10px] text-white/40">custom_vocabulary</span>
            </div>
            <p className="mb-3 text-xs text-white/50 leading-relaxed">
              {isArabic
                ? 'أضف مصطلحات تقنية أو أسماء أو كلمات حشو لتمييزها وتوجيه النموذج للتعرف عليها بدقة.'
                : 'Define terminology, names, or filler words to bias recognition.'}
            </p>

            {/* Quick Vocabulary Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px] text-white/40 mr-1">{isArabic ? 'مقترحات شائعة:' : 'Suggestions:'}</span>
              {(isArabic ? ARABIC_SUGGESTIONS : ENGLISH_SUGGESTIONS).map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => handleAddSpecificPhrase(phrase)}
                  className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-colors ${
                    phrases.includes(phrase)
                      ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  +{phrase}
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder={isArabic ? 'أدخل كلمة أو عبارة...' : 'e.g. Gemini, Kubernetes, Anthos...'}
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
                className="flex-1 border border-white/20 rounded-lg bg-black px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleAddPhrase}
                className="flex items-center gap-1 border border-white/30 rounded-lg bg-white/10 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isArabic ? 'إضافة' : 'Add'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {phrases.map((phrase) => (
                <span
                  key={phrase}
                  className="inline-flex items-center gap-1.5 border border-white/20 bg-white/10 rounded-lg px-2.5 py-1 font-mono text-xs font-bold text-white"
                >
                  <span>{phrase}</span>
                  <button
                    onClick={() => handleRemovePhrase(phrase)}
                    className="text-white/40 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {phrases.length === 0 && (
                <p className="font-mono text-xs italic text-white/40">
                  {isArabic ? 'لم تتم إضافة مفردات مخصصة.' : 'No custom vocabulary added.'}
                </p>
              )}
            </div>
          </div>

          {/* Payload Inspector */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white/60">
              <Code2 className="h-3.5 w-3.5" />
              <span>{isArabic ? 'بيانات تهيئة الجلسة الحية (Live Setup Payload)' : 'Live Setup JSON Payload'}</span>
            </div>
            <pre className="overflow-x-auto border border-white/15 rounded-xl bg-white/5 p-4 font-mono text-[11px] text-white/90 leading-relaxed text-left" dir="ltr">
              {JSON.stringify(sessionSetupPayload, null, 2)}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-black px-6 py-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-white/50">
            <Info className="h-3.5 w-3.5" />
            <span>{isArabic ? 'تُطبق الإعدادات على الجلسة الحالية والتسجيل التالي' : 'Updates apply on next session'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white cursor-pointer"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-gray-200 cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>{isArabic ? 'تم الحفظ' : 'Applied'}</span>
                </>
              ) : (
                <span>{isArabic ? 'حفظ وتطبيق' : 'Apply Setup'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

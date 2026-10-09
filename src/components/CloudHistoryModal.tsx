import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cloud,
  X,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Download,
  Clock,
  FileText,
  Sparkles,
  LogIn,
  LogOut,
  User as UserIcon,
  HardDrive,
  RefreshCw,
  AlertCircle,
  Database,
  Radio,
  FileAudio,
  Bot
} from 'lucide-react';
import { SavedTranscription, AppLanguage } from '../types';
import { User, signInWithGoogle, logOut } from '../firebase';

interface CloudHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  savedTranscriptions: SavedTranscription[];
  isLoading: boolean;
  onRefresh: () => void;
  onLoadIntoEditor: (item: SavedTranscription) => void;
  onDelete: (id: string) => Promise<void>;
  appLang: AppLanguage;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const CloudHistoryModal: React.FC<CloudHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  savedTranscriptions,
  isLoading,
  onRefresh,
  onLoadIntoEditor,
  onDelete,
  appLang,
  onSignIn,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'live' | 'file' | 'voice_live'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTabPerItem, setActiveTabPerItem] = useState<Record<string, 'smart' | 'verbatim'>>({});
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const isArabic = appLang === 'ar';

  const filteredItems = useMemo(() => {
    return savedTranscriptions.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.smartText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.verbatimText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSource = filterSource === 'all' || item.source === filterSource;

      return matchesSearch && matchesSource;
    });
  }, [savedTranscriptions, searchQuery, filterSource]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = savedTranscriptions.length;
    const totalSeconds = savedTranscriptions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
    const totalWords = savedTranscriptions.reduce((acc, curr) => acc + (curr.wordCount || 0), 0);
    return {
      totalCount,
      totalMinutes: Math.round(totalSeconds / 60),
      totalWords,
    };
  }, [savedTranscriptions]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (item: SavedTranscription) => {
    const content = `--- Smart Transcript ---\n${item.smartText}\n\n--- Verbatim Transcript ---\n${item.verbatimText}\n\nDate: ${new Date(item.createdAt).toLocaleString()}\nDuration: ${item.durationSeconds}s\nWords: ${item.wordCount}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${new Date(item.createdAt).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteItem = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId((curr) => (curr === id ? null : curr));
      }, 4000);
      return;
    }

    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      await onSignIn();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setIsAuthLoading(true);
    try {
      await onSignOut();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden text-white"
          dir={isArabic ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">
                    {isArabic ? 'سجل السحابة وقاعدة بيانات Firestore' : 'Cloud History & Firestore Database'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Database className="w-3 h-3" />
                    <span>{isArabic ? 'سحابة نشطة' : 'Live Sync'}</span>
                  </span>
                </div>
                <p className="text-xs text-white/50">
                  {isArabic
                    ? 'حفظ تلقائي ودائم لجميع تسجيلاتك الصوتية ونتائج النسخ الذكي والحرفي'
                    : 'Persistent cloud storage for your smart & verbatim transcripts'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Status Bar */}
          <div className="px-6 py-3 bg-zinc-900/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-indigo-400/50 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="text-xs">
                  <p className="font-semibold text-white/90">{currentUser.displayName || currentUser.email}</p>
                  <p className="text-[11px] text-white/50">{currentUser.email}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-300/90">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isArabic
                    ? 'أنت تتصفح كضيف. سجّل الدخول بحساب Google لمزامنة التسجيلات في سحابتك الخاصة.'
                    : 'Browsing as guest. Sign in with Google to synchronize your transcripts.'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {currentUser ? (
                <button
                  onClick={handleGoogleSignOut}
                  disabled={isAuthLoading}
                  className="px-3 py-1.5 rounded-xl border border-white/15 hover:bg-white/10 text-xs text-white/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تسجيل الدخول بـ Google' : 'Sign in with Google'}</span>
                </button>
              )}

              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-white/70 transition-colors cursor-pointer"
                title={isArabic ? 'تحديث السجل' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-6 py-3.5 bg-black/40 border-b border-white/10 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
              <div className="text-xl font-bold text-indigo-400">{stats.totalCount}</div>
              <div className="text-[11px] text-white/50">{isArabic ? 'تسجيل محفوظ' : 'Saved Transcripts'}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
              <div className="text-xl font-bold text-emerald-400">{stats.totalMinutes}m</div>
              <div className="text-[11px] text-white/50">{isArabic ? 'إجمالي الدقائق' : 'Total Minutes'}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
              <div className="text-xl font-bold text-amber-400">{stats.totalWords}</div>
              <div className="text-[11px] text-white/50">{isArabic ? 'إجمالي الكلمات' : 'Total Words'}</div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/30">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isArabic ? 'ابحث في النصوص المحفوظة أو الملخصات...' : 'Search in saved transcripts or summaries...'}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Source Filter Badges */}
            <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setFilterSource('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterSource === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                {isArabic ? 'الكل' : 'All'}
              </button>
              <button
                onClick={() => setFilterSource('live')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  filterSource === 'live' ? 'bg-indigo-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>{isArabic ? 'مباشر' : 'Live'}</span>
              </button>
              <button
                onClick={() => setFilterSource('file')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  filterSource === 'file' ? 'bg-indigo-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                <FileAudio className="w-3 h-3" />
                <span>{isArabic ? 'ملف' : 'File'}</span>
              </button>
              <button
                onClick={() => setFilterSource('voice_live')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  filterSource === 'voice_live' ? 'bg-indigo-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                <Bot className="w-3 h-3" />
                <span>{isArabic ? 'رد صوتي' : 'Voice'}</span>
              </button>
            </div>
          </div>

          {/* Transcript Cards List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[50vh]">
            {filteredItems.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3 text-white/50">
                <HardDrive className="w-12 h-12 text-white/20 stroke-1" />
                <p className="text-sm">
                  {searchQuery
                    ? (isArabic ? 'لم يتم العثور على تسجيلات تطابق بحثك.' : 'No saved transcripts matched your search.')
                    : (isArabic ? 'لا توجد تسجيلات محفوظة حتى الآن في السحابة.' : 'No saved transcripts in the cloud yet.')}
                </p>
                <p className="text-xs text-white/30 max-w-sm">
                  {isArabic
                    ? 'بعد الانتهاء من التسجيل المباشر أو رفع ملف صوتي، اضغط على زر "حفظ في السحابة" لحفظه هنا دائماً.'
                    : 'When you record audio or upload a file, click "Save to Cloud" to store it permanently.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const currentTab = activeTabPerItem[item.id] || 'smart';
                const activeText = currentTab === 'smart' ? item.smartText : item.verbatimText;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/50 hover:border-indigo-500/30 transition-all p-4 flex flex-col gap-3"
                  >
                    {/* Item Top Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        {item.source === 'file' ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px] font-medium flex items-center gap-1">
                            <FileAudio className="w-3 h-3" />
                            <span>{isArabic ? 'ملف صوتي' : 'Audio File'}</span>
                          </span>
                        ) : item.source === 'voice_live' ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 text-[10px] font-medium flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            <span>{isArabic ? 'رد صوتي' : 'Voice Reply'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            <span>{isArabic ? 'تسجيل مباشر' : 'Live Session'}</span>
                          </span>
                        )}

                        <span className="text-white/40 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-white/50 text-[11px]">
                        <span>{item.durationSeconds}s</span>
                        <span>•</span>
                        <span>{item.wordCount} {isArabic ? 'كلمة' : 'words'}</span>
                      </div>
                    </div>

                    {/* Summary badge if present */}
                    {item.summary && (
                      <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{item.summary}</span>
                      </div>
                    )}

                    {/* Smart / Verbatim Tab Selector */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setActiveTabPerItem((prev) => ({ ...prev, [item.id]: 'smart' }))
                          }
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            currentTab === 'smart'
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {isArabic ? 'النسخ الذكي المنقح' : 'Smart Transcript'}
                        </button>
                        <button
                          onClick={() =>
                            setActiveTabPerItem((prev) => ({ ...prev, [item.id]: 'verbatim' }))
                          }
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            currentTab === 'verbatim'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {isArabic ? 'النسخ الحرفي' : 'Verbatim'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopy(item.id, activeText)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title={isArabic ? 'نسخ النص المعروض' : 'Copy active text'}
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Download button */}
                        <button
                          onClick={() => handleDownload(item)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors cursor-pointer"
                          title={isArabic ? 'تصدير كملف نصي' : 'Export as text file'}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Load into Editor button */}
                        <button
                          onClick={() => {
                            onLoadIntoEditor(item);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                          title={isArabic ? 'استعادة وعرض في شاشة النسخ' : 'Load in Studio'}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{isArabic ? 'فتح في الاستوديو' : 'Load in Studio'}</span>
                        </button>

                        {/* Delete button with inline confirmation */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            confirmDeleteId === item.id
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                          }`}
                          title={
                            confirmDeleteId === item.id
                              ? isArabic
                                ? 'اضغط مرة أخرى لتأكيد الحذف'
                                : 'Click again to confirm deletion'
                              : isArabic
                              ? 'حذف من السحابة'
                              : 'Delete from Cloud'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {confirmDeleteId === item.id && (
                            <span className="text-[11px] font-bold">
                              {isArabic ? 'تأكيد الحذف؟' : 'Confirm?'}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Text Preview Box */}
                    <div className="p-3 rounded-xl bg-black/50 border border-white/5 text-xs text-white/80 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {activeText || (isArabic ? 'لا يوجد نص متاح' : 'No text available')}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/50 flex items-center justify-between text-xs text-white/50">
            <span>
              {isArabic
                ? 'متصل بقاعدة بيانات Google Cloud Firestore المشفرة والآمنة'
                : 'Connected to Google Cloud Firestore with end-to-end security'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
            >
              {isArabic ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

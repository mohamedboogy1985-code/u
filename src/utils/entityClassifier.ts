import { KeywordCategory, KeywordClassification } from '../types';

export const KEYWORD_CATEGORIES: Record<KeywordCategory, KeywordClassification> = {
  person: {
    category: 'person',
    labelAr: 'أشخاص وأسماء',
    labelEn: 'People & Names',
    color: '#38bdf8', // Sky Blue
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
    iconName: 'User',
  },
  location: {
    category: 'location',
    labelAr: 'أماكن ومواقع',
    labelEn: 'Places & Locations',
    color: '#34d399', // Emerald
    badgeBg: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
    iconName: 'MapPin',
  },
  organization: {
    category: 'organization',
    labelAr: 'مؤسسات وشركات',
    labelEn: 'Organizations',
    color: '#c084fc', // Purple
    badgeBg: 'rgba(192, 132, 252, 0.2)',
    borderColor: '#c084fc',
    iconName: 'Building',
  },
  tech: {
    category: 'tech',
    labelAr: 'تقنية ومصطلحات',
    labelEn: 'Technology & Terms',
    color: '#2dd4bf', // Teal
    badgeBg: 'rgba(45, 212, 191, 0.2)',
    borderColor: '#2dd4bf',
    iconName: 'Cpu',
  },
  datetime: {
    category: 'datetime',
    labelAr: 'أرقام ومواعيد',
    labelEn: 'Dates & Numbers',
    color: '#fbbf24', // Amber
    badgeBg: 'rgba(251, 191, 36, 0.2)',
    borderColor: '#fbbf24',
    iconName: 'Calendar',
  },
  action: {
    category: 'action',
    labelAr: 'قرارات ومهام',
    labelEn: 'Actions & Decisions',
    color: '#f43f5e', // Rose
    badgeBg: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#f43f5e',
    iconName: 'CheckSquare',
  },
};

// Word sets for fast live client-side matching
const PERSON_WORDS = new Set([
  // Arabic Names & Titles
  'محمد', 'أحمد', 'احمد', 'محمود', 'علي', 'عمر', 'عثمان', 'يوسف', 'إبراهيم', 'ابراهيم',
  'خالد', 'سالم', 'سعيد', 'عبدالله', 'عبدالرحمن', 'سارة', 'ساره', 'فاطمة', 'فاطمه',
  'مريم', 'نورة', 'نوره', 'ليلى', 'زينب', 'هدى', 'منى', 'دكتور', 'الدكتور', 'دكتورة',
  'مهندس', 'المهندس', 'أستاذ', 'الاستاذ', 'شيخ', 'الشيخ', 'سيد', 'السيد', 'سيدة',
  'وزير', 'الوزير', 'رئيس', 'الرئيس', 'مدير', 'المدير',
  // English Names & Titles
  'john', 'david', 'michael', 'james', 'sarah', 'emily', 'alex', 'sam', 'dr', 'doctor',
  'prof', 'professor', 'mr', 'mrs', 'ms', 'ceo', 'cto', 'founder', 'director'
]);

const LOCATION_WORDS = new Set([
  // Arabic Locations
  'الرياض', 'جدة', 'جده', 'مكة', 'مكه', 'المدينة', 'المدينه', 'دبي', 'أبوظبي', 'ابوظبي',
  'الدوحة', 'الدوحه', 'القاهرة', 'القاهره', 'الإسكندرية', 'الاسكندريه', 'عمان', 'بيروت',
  'بغداد', 'دمشق', 'القدس', 'تونس', 'الجزائر', 'الرباط', 'السعودية', 'السعوديه',
  'مصر', 'الإمارات', 'الامارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن', 'الاردن',
  'باريس', 'لندن', 'نيويورك', 'واشنطن', 'برلين', 'طوكيو', 'مكتب', 'المكتب', 'جامعة',
  'الجامعة', 'مستشفى', 'المستشفى', 'مطار', 'المطار', 'شارع', 'الشارع', 'مدينة', 'المدينة',
  'دولة', 'الدولة', 'عاصمة', 'العاصمة',
  // English Locations
  'cairo', 'riyadh', 'dubai', 'london', 'paris', 'tokyo', 'berlin', 'new york', 'usa',
  'america', 'saudi', 'egypt', 'uae', 'europe', 'asia', 'office', 'airport', 'hospital',
  'university', 'school', 'city', 'country'
]);

const ORGANIZATION_WORDS = new Set([
  // Arabic Organizations & Brands
  'جوجل', 'مايكروسوفت', 'أبل', 'ابل', 'أمازون', 'امازون', 'تسلا', 'أوبن', 'اوبن', 'جيميني',
  'فيسبوك', 'تويتر', 'يوتيوب', 'إنستغرام', 'انستغرام', 'تيك', 'لينكد', 'وزارة', 'الوزارة',
  'هيئة', 'الهيئة', 'شركة', 'الشركة', 'مؤسسة', 'المؤسسة', 'منظمة', 'المنظمة', 'بنك', 'البنك',
  'أرامكو', 'ارامكو', 'سابك', 'إس', 'اس',
  // English Organizations & Brands
  'google', 'microsoft', 'apple', 'amazon', 'tesla', 'openai', 'gemini', 'meta', 'facebook',
  'twitter', 'youtube', 'instagram', 'linkedin', 'ibm', 'nvidia', 'intel', 'company',
  'corporation', 'bank', 'ministry', 'un', 'who'
]);

const TECH_WORDS = new Set([
  // Arabic Tech
  'ذكاء', 'اصطناعي', 'خوارزمية', 'خوارزميات', 'برمجة', 'سحابة', 'سحابي', 'خادم', 'سيرفر',
  'بيانات', 'نموذج', 'كود', 'شفرة', 'تطبيق', 'موقع', 'إنترنت', 'انترنت', 'برمجيات',
  'روبوت', 'أتمتة', 'اتمتة', 'حاسوب', 'كمبيوتر', 'هاتف', 'منصة', 'تقنية', 'تكنولوجيا',
  'شبكة', 'واجهة', 'تطوير', 'أمان', 'امان',
  // English Tech
  'ai', 'api', 'cloud', 'server', 'database', 'algorithm', 'code', 'software', 'app',
  'application', 'model', 'data', 'web', 'internet', 'robot', 'automation', 'tech',
  'technology', 'computer', 'python', 'react', 'typescript', 'javascript', 'framework',
  'platform', 'machine', 'learning', 'security'
]);

const DATETIME_WORDS = new Set([
  // Arabic Date/Time/Numbers
  'اليوم', 'أمس', 'امس', 'غداً', 'غدا', 'الأحد', 'الاحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
  'الاربعاء', 'الخميس', 'الجمعة', 'الجمعه', 'السبت', 'يناير', 'فبراير', 'مارس', 'أبريل',
  'ابريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'اغسطس', 'سبتمبر', 'أكتوبر', 'اكتوبر',
  'نوفمبر', 'ديسمبر', 'ساعة', 'دقيقة', 'دقيقه', 'ثانية', 'ثانيه', 'سنة', 'عام', 'شهر',
  'أسبوع', 'اسبوع', 'مئة', 'مائة', 'ألف', 'الف', 'مليون', 'مليار', 'أول', 'اول', 'ثاني',
  'نسبة', 'مئوية', 'ريال', 'دولار', 'جنيه',
  // English Date/Time/Numbers
  'today', 'yesterday', 'tomorrow', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december', 'hour', 'minute', 'second',
  'year', 'month', 'week', 'percent', 'dollar', 'euro', 'hundred', 'thousand', 'million'
]);

const ACTION_WORDS = new Set([
  // Arabic Actions & Decisions
  'قرار', 'قررنا', 'اتفاق', 'اتفقنا', 'سنقوم', 'يجب', 'يلزم', 'مطلوب', 'خطة', 'خطه',
  'هدف', 'أهداف', 'اهداف', 'مهمة', 'مهمه', 'مهام', 'موعد', 'تسليم', 'اجتماع', 'استراتيجية',
  'استراتيجيه', 'إنجاز', 'انجاز', 'تنفيذ', 'مشروع', 'توصية', 'توصيه',
  // English Actions & Decisions
  'decision', 'agreed', 'plan', 'goal', 'task', 'deadline', 'action', 'meeting',
  'strategy', 'deliverable', 'priority', 'must', 'should', 'requirement'
]);

export function classifyWord(rawWord: string): KeywordClassification | null {
  const clean = rawWord.toLowerCase().replace(/[^a-z0-9'\u0600-\u06FF]/g, '').trim();
  if (!clean) return null;

  // Check for numeric patterns (e.g. 100, 2026, 50%, $10, ١٢٣)
  if (/^(\d+|[٠-٩]+|\$|%)+$/.test(clean) || /\d+/.test(clean)) {
    return KEYWORD_CATEGORIES.datetime;
  }

  if (PERSON_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.person;
  }
  if (LOCATION_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.location;
  }
  if (ORGANIZATION_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.organization;
  }
  if (TECH_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.tech;
  }
  if (DATETIME_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.datetime;
  }
  if (ACTION_WORDS.has(clean)) {
    return KEYWORD_CATEGORIES.action;
  }

  return null;
}

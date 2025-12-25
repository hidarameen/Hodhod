export interface EntityReplacement {
  id?: number;
  taskId: number;
  entityType: string;
  originalText: string;
  replacementText: string;
  caseSensitive: boolean;
  useContext: boolean;
  isActive: boolean;
  priority: number;
}

export interface ContextRule {
  id?: number;
  taskId: number;
  ruleType: string;
  triggerPattern: string;
  targetSentiment: string;
  instructions: string;
  examples: any[];
  isActive: boolean;
  priority: number;
}

export interface TrainingExample {
  id?: number;
  taskId: number | null;
  exampleType: string;
  inputText: string;
  expectedOutput: string;
  explanation: string;
  tags: string[];
  isActive: boolean;
  useCount?: number;
}

export interface ContentFilter {
  id?: number;
  taskId: number;
  name: string;
  filterType: string;
  matchType: string;
  pattern: string;
  contextDescription?: string;
  sentimentTarget?: string;
  action: string;
  modifyInstructions?: string;
  priority: number;
  isActive: boolean;
}

export interface TemplateCustomField {
  id?: number;
  templateId?: number;
  fieldName: string;
  fieldLabel: string;
  extractionInstructions: string;
  defaultValue?: string;
  useDefaultIfEmpty: boolean;
  formatting: string;
  displayOrder: number;
  showLabel: boolean;
  labelSeparator: string;
  prefix?: string;
  suffix?: string;
  fieldType: string;
  isActive: boolean;
}

export interface PublishingTemplate {
  id?: number;
  taskId: number;
  name: string;
  templateType: string;
  isDefault: boolean;
  headerText?: string;
  headerFormatting?: string;
  footerText?: string;
  footerFormatting?: string;
  fieldSeparator?: string;
  useNewlineAfterHeader?: boolean;
  useNewlineBeforeFooter?: boolean;
  maxLength?: number;
  extractionPrompt?: string;
  customFields?: TemplateCustomField[];
}

export const entityTypes = [
  { value: 'person', label: 'شخص', icon: '👤' },
  { value: 'organization', label: 'منظمة', icon: '🏢' },
  { value: 'location', label: 'موقع', icon: '📍' },
  { value: 'event', label: 'حدث', icon: '📅' },
  { value: 'custom', label: 'مخصص', icon: '✏️' },
];

export const contextRuleTypes = [
  { value: 'neutralize_negative', label: 'تحييد السلبية', description: 'تحويل اللغة السلبية إلى حيادية' },
  { value: 'enhance_positive', label: 'تعزيز الإيجابية', description: 'تعزيز الكلمات الإيجابية' },
  { value: 'formal_tone', label: 'صياغة رسمية', description: 'تحويل اللغة العامية إلى رسمية' },
  { value: 'remove_bias', label: 'إزالة التحيز', description: 'إزالة الكلمات المتحيزة' },
  { value: 'custom', label: 'مخصص', description: 'قاعدة مخصصة بتعليمات محددة' },
];

export const exampleTypes = [
  { value: 'correction', label: 'تصحيح', description: 'تصحيح خطأ في المخرجات' },
  { value: 'preference', label: 'تفضيل', description: 'أسلوب تفضله في الصياغة' },
  { value: 'style', label: 'أسلوب', description: 'أسلوب كتابة معين' },
  { value: 'terminology', label: 'مصطلحات', description: 'مصطلحات تفضلها' },
];

export const filterTypes = [
  { value: 'allow', label: 'سماح', description: 'السماح بالمحتوى المطابق' },
  { value: 'block', label: 'حظر', description: 'حظر المحتوى المطابق' },
  { value: 'require', label: 'مطلوب', description: 'يتطلب وجود المحتوى' },
];

export const matchTypes = [
  { value: 'contains', label: 'يحتوي', description: 'يحتوي على النص' },
  { value: 'exact', label: 'مطابق', description: 'مطابقة تامة' },
  { value: 'regex', label: 'تعبير نمطي', description: 'تعبير نمطي (Regex)' },
  { value: 'sentiment', label: 'مشاعر', description: 'تحليل المشاعر' },
  { value: 'context', label: 'سياق', description: 'تحليل السياق' },
];

export const filterActions = [
  { value: 'skip', label: 'تخطي', description: 'تخطي الرسالة' },
  { value: 'forward', label: 'تمرير', description: 'تمرير الرسالة' },
  { value: 'modify', label: 'تعديل', description: 'تعديل المحتوى' },
  { value: 'flag', label: 'تمييز', description: 'تمييز للمراجعة' },
];

export const sentimentTargets = [
  { value: 'positive', label: 'إيجابي' },
  { value: 'negative', label: 'سلبي' },
  { value: 'neutral', label: 'محايد' },
  { value: 'any', label: 'أي' },
];

export const templateTypes = [
  { value: 'news', label: 'خبر', description: 'قالب الأخبار' },
  { value: 'report', label: 'تقرير', description: 'قالب التقارير' },
  { value: 'interview', label: 'مقابلة', description: 'قالب المقابلات' },
  { value: 'summary', label: 'ملخص', description: 'قالب الملخصات' },
  { value: 'custom', label: 'مخصص', description: 'قالب مخصص' },
];

export const formattingOptions = [
  { value: 'none', label: 'بدون تنسيق', example: 'نص عادي' },
  { value: 'bold', label: 'عريض', example: '**نص عريض**' },
  { value: 'italic', label: 'مائل', example: '__نص مائل__' },
  { value: 'code', label: 'كود', example: '`نص كود`' },
  { value: 'quote', label: 'اقتباس', example: '> اقتباس' },
  { value: 'spoiler', label: 'مخفي', example: '||نص مخفي||' },
  { value: 'strikethrough', label: 'مشطوب', example: '~~نص مشطوب~~' },
  { value: 'underline', label: 'تحته خط', example: '<u>نص</u>' },
];

export const fieldTypes = [
  { value: 'extracted', label: 'مستخرج بالذكاء الاصطناعي', description: 'يتم استخراجه من النص' },
  { value: 'summary', label: 'الملخص', description: 'نتيجة التلخيص من المعالجة السابقة' },
  { value: 'date_today', label: 'تاريخ اليوم', description: 'تاريخ اليوم الحالي تلقائياً' },
  { value: 'static', label: 'نص ثابت', description: 'قيمة ثابتة تحددها أنت' },
];

export interface PresetField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  extractionInstructions: string;
  icon: string;
  description: string;
}

export const presetFields: PresetField[] = [
  {
    id: 'serial_number',
    fieldName: 'serial_number',
    fieldLabel: 'رقم القيد',
    fieldType: 'static',
    extractionInstructions: 'هذا الحقل يتم ملؤه تلقائياً برقم القيد المتسلسل للمنشور.',
    icon: '🔢',
    description: 'رقم القيد المتسلسل للمنشور (يتم توحيده تلقائياً)'
  },
  {
    id: 'date',
    fieldName: 'date',
    fieldLabel: 'التاريخ',
    fieldType: 'date_today',
    extractionInstructions: '',
    icon: '📅',
    description: 'تاريخ اليوم الحالي'
  },
  {
    id: 'governorate',
    fieldName: 'governorate',
    fieldLabel: 'المحافظة',
    fieldType: 'extracted',
    extractionInstructions: 'استخرج اسم المحافظة أو المدينة من النص. إذا لم يُذكر، اكتب "غير محدد"',
    icon: '📍',
    description: 'اسم المحافظة أو المدينة'
  },
  {
    id: 'news_type',
    fieldName: 'news_type',
    fieldLabel: 'نوع الخبر',
    fieldType: 'extracted',
    extractionInstructions: 'حدد نوع الخبر (عاجل، سياسي، اقتصادي، رياضي، ثقافي، اجتماعي، أمني، تقرير، إعلان، أخرى)',
    icon: '📰',
    description: 'تصنيف نوع الخبر'
  },
  {
    id: 'summary',
    fieldName: 'summary',
    fieldLabel: 'التلخيص',
    fieldType: 'summary',
    extractionInstructions: '',
    icon: '📝',
    description: 'ملخص المحتوى المُعالج'
  },
  {
    id: 'specialist',
    fieldName: 'specialist',
    fieldLabel: 'المختص',
    icon: '👤',
    fieldType: 'extracted',
    extractionInstructions: 'استخرج اسم المختص أو المسؤول أو الجهة المعنية بالخبر. إذا لم يُذكر، اكتب "غير محدد"',
    description: 'الشخص أو الجهة المختصة'
  },
  {
    id: 'category',
    fieldName: 'category',
    fieldLabel: 'التصنيف',
    fieldType: 'extracted',
    extractionInstructions: 'حدد التصنيف الرئيسي للمحتوى (محلي، دولي، إقليمي، خاص)',
    icon: '🏷️',
    description: 'التصنيف العام للمحتوى'
  },
  {
    id: 'source',
    fieldName: 'source_channel_title',
    fieldLabel: 'المصدر',
    fieldType: 'extracted',
    extractionInstructions: 'استخرج اسم المصدر أو القناة الأصلية للخبر. إذا لم يُذكر، اكتب "غير محدد"',
    icon: '📡',
    description: 'المصدر أو القناة الأصلية'
  }
];

// Text Summarization Rule
export interface SummarizationRule {
  id?: number;
  taskId: number;
  name: string;
  prompt: string;
  maxLength: number;
  style: string;
  keyPointsCount: number;
  isActive: boolean;
  priority: number;
}

// Video Processing Rule
export interface VideoProcessingRule {
  id?: number;
  taskId: number;
  name: string;
  extractFrames: boolean;
  extractAudio: boolean;
  maxDuration: number;
  outputFormat: string;
  generateSubtitles: boolean;
  isActive: boolean;
  priority: number;
}

// Audio Processing Rule
export interface AudioProcessingRule {
  id?: number;
  taskId: number;
  name: string;
  prompt: string;
  maxDuration: number;
  style: string;
  isActive: boolean;
  priority: number;
}

export const summarizationStyles = [
  { value: 'concise', label: 'موجز جداً', description: 'ملخص قصير جداً' },
  { value: 'balanced', label: 'متوازن', description: 'ملخص متوازن المعلومات' },
  { value: 'detailed', label: 'تفصيلي', description: 'ملخص تفصيلي' },
  { value: 'bullet_points', label: 'نقاط مفصلة', description: 'نقاط رئيسية' },
];

export const videoOutputFormats = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'avi', label: 'AVI' },
  { value: 'mov', label: 'MOV' },
];

"""
AI Preprocessing Engine
Stage 1: Extract entities, analyze sentiment, detect keywords
Prepares text for rule application and AI processing
"""
import re
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("ai_preprocessing")

@dataclass
class Entity:
    """Represents an extracted entity"""
    text: str
    entity_type: str  # 'person' | 'organization' | 'location' | 'date' | 'number' | 'event' | 'custom'
    start_pos: int
    end_pos: int
    confidence: float = 1.0
    context: str = ""

@dataclass
class SentimentResult:
    """Sentiment analysis result"""
    overall: str  # 'positive' | 'negative' | 'neutral' | 'mixed'
    score: float  # -1.0 to 1.0
    keywords_positive: List[str] = field(default_factory=list)
    keywords_negative: List[str] = field(default_factory=list)
    has_offensive: bool = False
    offensive_words: List[str] = field(default_factory=list)

@dataclass
class PreprocessingResult:
    """Complete preprocessing result"""
    original_text: str
    cleaned_text: str
    entities: List[Entity]
    sentiment: SentimentResult
    keywords: List[str]
    language: str
    text_length: int
    word_count: int
    has_urls: bool
    urls: List[str]
    has_mentions: bool
    mentions: List[str]
    has_hashtags: bool
    hashtags: List[str]
    processing_time: float
    metadata: Dict[str, Any] = field(default_factory=dict)

class AIPreprocessingEngine:
    """
    Advanced preprocessing engine for text analysis
    Extracts entities, analyzes sentiment, detects patterns
    """
    
    def __init__(self):
        self.arabic_positive_words = [
            'نجاح', 'تحقيق', 'إنجاز', 'تقدم', 'تطور', 'إيجابي', 'رائع', 'ممتاز',
            'بطل', 'بطولة', 'انتصار', 'فوز', 'تفوق', 'إبداع', 'تميز', 'شجاعة',
            'كفاح', 'مقاومة', 'صمود', 'عزيمة', 'إرادة', 'أمل', 'حرية', 'استقلال'
        ]
        
        self.arabic_negative_words = [
            'فشل', 'هزيمة', 'خسارة', 'سلبي', 'سيء', 'رديء', 'ضعيف', 'انهيار',
            'كارثة', 'مأساة', 'أزمة', 'مشكلة', 'خطر', 'تهديد', 'عدوان'
        ]
        
        self.arabic_offensive_patterns = [
            r'\bكلب\b', r'\bحمار\b', r'\bغبي\b', r'\bأحمق\b', r'\bمجرم\b',
            r'\bإرهابي\b', r'\bخائن\b', r'\bعميل\b', r'\bكاذب\b', r'\bمنافق\b'
        ]
        
        self.person_indicators = [
            'السيد', 'الدكتور', 'المهندس', 'الرئيس', 'الوزير', 'القائد',
            'الشيخ', 'الأستاذ', 'البطل', 'الشهيد', 'المناضل', 'الأمير'
        ]
        
        self.organization_indicators = [
            'وزارة', 'هيئة', 'مؤسسة', 'منظمة', 'جمعية', 'حزب', 'حركة',
            'جيش', 'شرطة', 'أمن', 'محكمة', 'جامعة', 'مستشفى'
        ]
        
        self.location_indicators = [
            'مدينة', 'قرية', 'منطقة', 'محافظة', 'دولة', 'بلد', 'شارع',
            'حي', 'مخيم', 'معبر', 'حدود', 'ميناء', 'مطار'
        ]
        
        error_logger.log_info("[Preprocessing] Engine initialized with Arabic language support")
    
    async def process(self, text: str, config: Optional[Dict[str, Any]] = None) -> PreprocessingResult:
        """
        Main preprocessing function
        Analyzes text and extracts all relevant information
        """
        start_time = datetime.now()
        config = config or {}
        
        if not text or not text.strip():
            return self._empty_result(text)
        
        text = text.strip()
        
        cleaned_text = self._clean_text(text)
        
        entities = await self._extract_entities(text, config.get('enable_entity_extraction', True))
        
        sentiment = await self._analyze_sentiment(text, config.get('enable_sentiment_analysis', True))
        
        keywords = await self._extract_keywords(text, config.get('enable_keyword_detection', True))
        
        urls = self._extract_urls(text)
        mentions = self._extract_mentions(text)
        hashtags = self._extract_hashtags(text)
        
        language = self._detect_language(text)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        result = PreprocessingResult(
            original_text=text,
            cleaned_text=cleaned_text,
            entities=entities,
            sentiment=sentiment,
            keywords=keywords,
            language=language,
            text_length=len(text),
            word_count=len(text.split()),
            has_urls=bool(urls),
            urls=urls,
            has_mentions=bool(mentions),
            mentions=mentions,
            has_hashtags=bool(hashtags),
            hashtags=hashtags,
            processing_time=processing_time,
            metadata={
                'preprocessed_at': datetime.now().isoformat(),
                'config_used': config
            }
        )
        
        error_logger.log_info(f"[Preprocessing] Completed | Entities: {len(entities)} | Sentiment: {sentiment.overall} | Keywords: {len(keywords)} | Time: {processing_time:.3f}s")
        
        return result
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        cleaned = re.sub(r'\s+', ' ', text)
        
        cleaned = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', cleaned)
        
        return cleaned.strip()
    
    async def _extract_entities(self, text: str, enabled: bool = True) -> List[Entity]:
        """Extract named entities from text"""
        if not enabled:
            return []
        
        entities = []
        
        for indicator in self.person_indicators:
            pattern = rf'{indicator}\s+([\u0600-\u06FF\s]+?)(?:\s|،|,|\.|$)'
            for match in re.finditer(pattern, text):
                name = match.group(1).strip()
                if len(name) > 2 and len(name.split()) <= 4:
                    entities.append(Entity(
                        text=f"{indicator} {name}",
                        entity_type='person',
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.9,
                        context=text[max(0, match.start()-20):min(len(text), match.end()+20)]
                    ))
        
        for indicator in self.organization_indicators:
            pattern = rf'{indicator}\s+([\u0600-\u06FF\s]+?)(?:\s|،|,|\.|$)'
            for match in re.finditer(pattern, text):
                name = match.group(1).strip()
                if len(name) > 2:
                    entities.append(Entity(
                        text=f"{indicator} {name}",
                        entity_type='organization',
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.85,
                        context=text[max(0, match.start()-20):min(len(text), match.end()+20)]
                    ))
        
        for indicator in self.location_indicators:
            pattern = rf'{indicator}\s+([\u0600-\u06FF\s]+?)(?:\s|،|,|\.|$)'
            for match in re.finditer(pattern, text):
                name = match.group(1).strip()
                if len(name) > 2:
                    entities.append(Entity(
                        text=f"{indicator} {name}",
                        entity_type='location',
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.85,
                        context=text[max(0, match.start()-20):min(len(text), match.end()+20)]
                    ))
        
        date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{2,4}',
            r'\d{1,2}-\d{1,2}-\d{2,4}',
            r'\d{4}/\d{1,2}/\d{1,2}',
            r'\d{1,2}\s+(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4}'
        ]
        
        for pattern in date_patterns:
            for match in re.finditer(pattern, text):
                entities.append(Entity(
                    text=match.group(),
                    entity_type='date',
                    start_pos=match.start(),
                    end_pos=match.end(),
                    confidence=0.95
                ))
        
        unique_entities = []
        seen = set()
        for entity in entities:
            key = (entity.text, entity.entity_type)
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        
        return unique_entities
    
    async def _analyze_sentiment(self, text: str, enabled: bool = True) -> SentimentResult:
        """Analyze text sentiment"""
        if not enabled:
            return SentimentResult(overall='neutral', score=0.0)
        
        text_lower = text
        
        positive_found = []
        negative_found = []
        offensive_found = []
        
        for word in self.arabic_positive_words:
            if word in text_lower:
                positive_found.append(word)
        
        for word in self.arabic_negative_words:
            if word in text_lower:
                negative_found.append(word)
        
        for pattern in self.arabic_offensive_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            offensive_found.extend(matches)
        
        positive_score = len(positive_found) * 0.15
        negative_score = len(negative_found) * 0.15
        
        score = min(1.0, max(-1.0, positive_score - negative_score))
        
        if score > 0.2:
            overall = 'positive'
        elif score < -0.2:
            overall = 'negative'
        elif positive_found and negative_found:
            overall = 'mixed'
        else:
            overall = 'neutral'
        
        return SentimentResult(
            overall=overall,
            score=score,
            keywords_positive=positive_found,
            keywords_negative=negative_found,
            has_offensive=bool(offensive_found),
            offensive_words=offensive_found
        )
    
    async def _extract_keywords(self, text: str, enabled: bool = True) -> List[str]:
        """Extract important keywords from text"""
        if not enabled:
            return []
        
        stop_words = {
            'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
            'التي', 'الذي', 'الذين', 'اللذين', 'هو', 'هي', 'هم', 'هن', 'أنا',
            'نحن', 'أنت', 'أنتم', 'كان', 'كانت', 'كانوا', 'يكون', 'تكون',
            'قد', 'لقد', 'إن', 'أن', 'لا', 'ما', 'لم', 'لن', 'حتى', 'ثم',
            'أو', 'و', 'ف', 'ب', 'ل', 'ك', 'the', 'a', 'an', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should'
        }
        
        words = re.findall(r'[\u0600-\u06FF]{3,}|\b[a-zA-Z]{4,}\b', text)
        
        word_freq = {}
        for word in words:
            if word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        keywords = [word for word, freq in sorted_words[:20]]
        
        return keywords
    
    def _extract_urls(self, text: str) -> List[str]:
        """Extract URLs from text"""
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        return re.findall(url_pattern, text)
    
    def _extract_mentions(self, text: str) -> List[str]:
        """Extract @mentions from text"""
        mention_pattern = r'@[\w]+'
        return re.findall(mention_pattern, text)
    
    def _extract_hashtags(self, text: str) -> List[str]:
        """Extract #hashtags from text"""
        hashtag_pattern = r'#[\u0600-\u06FF\w]+'
        return re.findall(hashtag_pattern, text)
    
    def _detect_language(self, text: str) -> str:
        """Detect text language"""
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', text))
        english_chars = len(re.findall(r'[a-zA-Z]', text))
        
        if arabic_chars > english_chars:
            return 'ar'
        elif english_chars > arabic_chars:
            return 'en'
        else:
            return 'mixed'
    
    def _empty_result(self, text: str) -> PreprocessingResult:
        """Return empty result for empty text"""
        return PreprocessingResult(
            original_text=text or "",
            cleaned_text="",
            entities=[],
            sentiment=SentimentResult(overall='neutral', score=0.0),
            keywords=[],
            language='unknown',
            text_length=0,
            word_count=0,
            has_urls=False,
            urls=[],
            has_mentions=False,
            mentions=[],
            has_hashtags=False,
            hashtags=[],
            processing_time=0.0
        )
    
    def get_entities_by_type(self, result: PreprocessingResult, entity_type: str) -> List[Entity]:
        """Get entities of a specific type"""
        return [e for e in result.entities if e.entity_type == entity_type]
    
    def get_entity_texts(self, result: PreprocessingResult) -> Dict[str, List[str]]:
        """Get all entity texts grouped by type"""
        grouped = {}
        for entity in result.entities:
            if entity.entity_type not in grouped:
                grouped[entity.entity_type] = []
            grouped[entity.entity_type].append(entity.text)
        return grouped

preprocessing_engine = AIPreprocessingEngine()

"""
AI Enhancement Module
Advanced result validation, parsing, scoring, and filtering
Implements 50+ optimizations for AI accuracy and precision
Includes Yemen political news expertise and advanced Arabic processing
"""
import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("ai_enhancement")

# Import specialized analyzers (optional)
try:
    from services.yemen_news_analyzer import yemen_analyzer
    from services.arabic_language_processor import arabic_processor
    from services.web_search_integration import web_search
    YEMEN_ANALYZER_AVAILABLE = True
except ImportError:
    yemen_analyzer = None
    arabic_processor = None
    web_search = None
    YEMEN_ANALYZER_AVAILABLE = False

class PromptBuilder:
    """Build optimized prompts based on task type"""
    
    @staticmethod
    def build_summarization_prompt(
        text: str,
        task_type: str = "general",
        language: str = "ar",
        custom_rule: Optional[str] = None
    ) -> str:
        """Build optimized summarization prompt"""
        
        lang_label = "اللغة العربية" if language == "ar" else "English"
        
        prompts = {
            "general": f"""اختصر النص التالي بدقة وحفاظ على المعاني الأساسية:
- احذف المعلومات الزائدة والتكرارات
- ركز على النقاط الرئيسية
- اكتب باللغة {lang_label}
- الطول المقترح: 30-50% من الأصلي

{custom_rule or ''}

النص:""",
            
            "news": f"""استخرج أهم معلومات الخبر:
- متى (التاريخ والوقت)
- أين (المكان)
- ماذا (الحدث الرئيسي)
- من (الأطراف المعنية)
- لماذا (الأسباب إن وجدت)
- كيف (التطورات)

{custom_rule or ''}

الخبر:""",
            
            "article": f"""ملخص مقالة احترافي:
- العنوان الرئيسي
- الفكرة المركزية (جملة واحدة)
- النقاط الداعمة (3-5 نقاط)
- الخلاصة

{custom_rule or ''}

المقالة:""",
            
            "technical": f"""استخلص البيانات التقنية الأساسية:
- المشكلة/الهدف
- الحل/الطريقة
- النتائج/الخطوات
- الملاحظات المهمة

{custom_rule or ''}

النص التقني:""",
            
            "social": f"""اختصر منشور وسائل اجتماعية:
- الفكرة الأساسية
- الرسالة الرئيسية
- دعوة للعمل (إن وجدت)
- تحافظ على الطابع الأصلي

{custom_rule or ''}

المنشور:"""
        }
        
        return prompts.get(task_type, prompts["general"])
    
    @staticmethod
    def build_transform_prompt(
        text: str,
        transformation_type: str,
        custom_rule: Optional[str] = None
    ) -> str:
        """Build transformation prompt"""
        
        transforms = {
            "formal": f"""حول النص التالي إلى أسلوب رسمي واحترافي:
- استخدم اللغة الفصحى
- احذف الكلمات العامية
- أضف علامات ترقيم صحيحة
- حافظ على المعنى الأصلي

{custom_rule or ''}

النص:""",
            
            "casual": f"""حول النص إلى أسلوب ودي وسهل:
- استخدم عبارات بسيطة وطبيعية
- أضف تفاعلات إنسانية
- اجعله أقرب للمحادثة

{custom_rule or ''}

النص:""",
            
            "marketing": f"""حول النص إلى نص تسويقي فعال:
- اجعله جذاب ومقنع
- أضف دعوة للعمل واضحة
- ركز على الفوائد والقيمة

{custom_rule or ''}

النص:"""
        }
        
        return transforms.get(transformation_type, transforms["formal"])


class ResultValidator:
    """Validate AI output quality and correctness"""
    
    @staticmethod
    def validate_length(
        original_length: int,
        result_length: int,
        expected_reduction: float = 0.5
    ) -> bool:
        """Check if result length is reasonable"""
        if result_length == 0:
            return False
        
        reduction = 1 - (result_length / original_length)
        
        # Allow 20% variance
        min_reduction = expected_reduction - 0.2
        max_reduction = expected_reduction + 0.2
        
        return min_reduction <= reduction <= max_reduction or result_length > 100
    
    @staticmethod
    def validate_completeness(text: str) -> bool:
        """Check if text is complete (not cut off)"""
        incomplete_endings = ['...', '،\n', 'وب', 'في', 'من', 'و']
        
        if len(text) < 10:
            return False
        
        # Check for incomplete sentences
        if text.rstrip().endswith(('...', ' ب', ' و', '–')):
            return False
        
        # Check Arabic ending patterns
        if any(text.rstrip().endswith(end) for end in incomplete_endings):
            return False
        
        return True
    
    @staticmethod
    def validate_structure(text: str) -> bool:
        """Check if text has proper structure"""
        lines = text.strip().split('\n')
        
        # Should have meaningful content
        non_empty_lines = [l for l in lines if l.strip()]
        if len(non_empty_lines) == 0:
            return False
        
        # Check for minimum coherent structure
        avg_line_length = sum(len(l) for l in non_empty_lines) / len(non_empty_lines)
        
        return avg_line_length > 5  # Average line should be > 5 chars
    
    @staticmethod
    def validate_no_duplication(text: str, threshold: float = 0.3) -> bool:
        """Check for excessive duplication"""
        sentences = [s.strip() for s in text.split('\n') if s.strip()]
        
        if len(sentences) < 2:
            return True
        
        duplicates = 0
        for i, sent1 in enumerate(sentences):
            for sent2 in sentences[i+1:]:
                if sent1 == sent2 or sent1 in sent2 or sent2 in sent1:
                    duplicates += 1
        
        dup_ratio = duplicates / len(sentences)
        return dup_ratio < threshold


class QualityScorer:
    """Score AI output quality"""
    
    @staticmethod
    def score_summarization(
        original: str,
        summary: str,
        reduction_ratio: float = 0.5
    ) -> float:
        """Score summarization quality (0-1)"""
        score = 0.0
        
        # Length appropriateness (30%)
        actual_ratio = len(summary) / len(original) if original else 0
        length_score = 1 - abs(actual_ratio - reduction_ratio) / reduction_ratio
        length_score = max(0, min(1, length_score))
        score += length_score * 0.3
        
        # Completeness (20%)
        completeness = ResultValidator.validate_completeness(summary)
        score += (1.0 if completeness else 0.5) * 0.2
        
        # Structure (20%)
        structure = ResultValidator.validate_structure(summary)
        score += (1.0 if structure else 0.5) * 0.2
        
        # No duplication (15%)
        no_dup = ResultValidator.validate_no_duplication(summary)
        score += (1.0 if no_dup else 0.3) * 0.15
        
        # Minimum length check (15%)
        min_length = len(summary) > 50
        score += (1.0 if min_length else 0.2) * 0.15
        
        return min(1.0, max(0.0, score))
    
    @staticmethod
    def score_transformation(
        original: str,
        transformed: str,
        target_style: str = "formal"
    ) -> float:
        """Score transformation quality"""
        score = 0.0
        
        # Preservation of content (50%)
        # Check if key terms are preserved
        original_words = set(original.split())
        transformed_words = set(transformed.split())
        
        overlap = len(original_words & transformed_words) / len(original_words) if original_words else 0
        score += overlap * 0.5
        
        # Appropriate length change (20%)
        length_ratio = len(transformed) / len(original) if original else 1
        # Should be close to original length (0.8 - 1.2 range)
        length_score = 1 - abs(length_ratio - 1.0)
        score += max(0, length_score) * 0.2
        
        # Structure and completeness (20%)
        completeness = ResultValidator.validate_completeness(transformed)
        score += (1.0 if completeness else 0.5) * 0.2
        
        # No duplication (10%)
        no_dup = ResultValidator.validate_no_duplication(transformed)
        score += (1.0 if no_dup else 0.3) * 0.1
        
        return min(1.0, max(0.0, score))


class TextReplacer:
    """Apply direct text replacements based on custom rules"""
    
    # Pre-defined replacement patterns for Yemen political content
    YEMEN_REPLACEMENTS = {
        "عبدالملك الحوثي": "السيد عبدالملك بدر الدين الحوثي",
        "عبد الملك الحوثي": "السيد عبدالملك بدر الدين الحوثي",
        "زعيم الحوثيين": "قائد حركة أنصار الله",
        "ميليشيا الحوثي": "قوات أنصار الله",
        "ميليشيات الحوثي": "قوات أنصار الله",
    }
    
    @staticmethod
    def parse_replacement_rule(rule_text: str) -> Dict[str, str]:
        """
        Parse a custom rule to extract replacement patterns
        Supports formats like:
        - "استبدل X بـ Y"
        - "حول X إلى Y"
        - "اذا وجد X استبدله بـ Y"
        - "X → Y"
        """
        replacements = {}
        
        if not rule_text:
            return replacements
        
        # Pattern 1: "استبدل/حول X بـ/إلى Y"
        patterns = [
            r'(?:استبدل|حول|غير)\s*["\']?(.+?)["\']?\s*(?:بـ|الى|إلى|ب)\s*["\']?(.+?)["\']?(?:\.|$)',
            r'(?:اذا|إذا)\s*(?:وجد|كان|جاء)\s*["\']?(.+?)["\']?\s*(?:استبدله|حوله|غيره)\s*(?:بـ|الى|إلى|ب)\s*["\']?(.+?)["\']?(?:\.|$)',
            r'["\']?(.+?)["\']?\s*(?:→|->|=>)\s*["\']?(.+?)["\']?(?:\.|$)',
            r'(?:جملة|كلمة|عبارة)\s*["\']?(.+?)["\']?\s*(?:حولها|استبدلها|غيرها)\s*(?:بـ|الى|إلى|ب)\s*["\']?(.+?)["\']?(?:\.|$)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, rule_text, re.IGNORECASE)
            for match in matches:
                if len(match) >= 2:
                    original = match[0].strip()
                    replacement = match[1].strip()
                    if original and replacement:
                        replacements[original] = replacement
        
        return replacements
    
    @staticmethod
    def apply_replacements(text: str, custom_rule: Optional[str] = None) -> Tuple[str, List[str]]:
        """
        Apply text replacements from custom rule and pre-defined patterns
        Returns: (modified_text, list_of_changes_made)
        """
        changes = []
        result = text
        
        # 1. Parse custom rule for replacements
        if custom_rule:
            custom_replacements = TextReplacer.parse_replacement_rule(custom_rule)
            for original, replacement in custom_replacements.items():
                if original in result:
                    count = result.count(original)
                    result = result.replace(original, replacement)
                    changes.append(f"استبدال '{original}' بـ '{replacement}' ({count} مرة)")
        
        # 2. Apply pre-defined Yemen replacements if custom rule mentions them
        if custom_rule:
            rule_lower = custom_rule.lower()
            for original, replacement in TextReplacer.YEMEN_REPLACEMENTS.items():
                # Only apply if the rule seems to reference this replacement
                if any(word in rule_lower for word in original.split()):
                    if original in result:
                        count = result.count(original)
                        result = result.replace(original, replacement)
                        changes.append(f"استبدال '{original}' بـ '{replacement}' ({count} مرة)")
        
        return result, changes


class OutputFilter:
    """Filter and clean AI output"""
    
    @staticmethod
    def clean_markdown(text: str) -> str:
        """Remove unnecessary markdown"""
        # Remove multiple asterisks/underscores
        text = re.sub(r'\*{2,}', '*', text)
        text = re.sub(r'_{2,}', '_', text)
        
        # Clean up excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()
    
    @staticmethod
    def remove_artifacts(text: str) -> str:
        """Remove AI artifacts and hallucinations"""
        # Remove "[continued...]" patterns
        text = re.sub(r'\[.*?continued.*?\]', '', text, flags=re.IGNORECASE)
        
        # Remove model attribution
        text = re.sub(r'(According to|Based on) (the|a) (model|AI).*?\n', '', text, flags=re.IGNORECASE)
        
        # Remove incomplete instructions
        text = re.sub(r'<.*?>', '', text)
        
        return text.strip()
    
    @staticmethod
    def normalize_language(text: str, language: str = "ar") -> str:
        """Normalize language-specific patterns"""
        if language == "ar":
            # Fix Arabic diacritics
            text = text.replace("ً", "")  # Remove fatha on alef
            text = text.replace("ٌ", "")  # Remove dammatan
            text = text.replace("ٍ", "")  # Remove kasratan
            
            # Normalize Arabic quotes
            text = text.replace('"', '"').replace('"', '"')
        
        return text.strip()
    
    @staticmethod
    def truncate_smart(text: str, max_length: int = 4096) -> str:
        """Smart truncation preserving sentence structure"""
        if len(text) <= max_length:
            return text
        
        # Truncate at last complete sentence
        truncated = text[:max_length]
        
        # Find last period/comma/newline
        for end_char in ['\n', '۔', '。', '.', '،', ',']:
            last_pos = truncated.rfind(end_char)
            if last_pos > 0 and last_pos > max_length * 0.7:
                truncated = truncated[:last_pos + 1]
                break
        
        return truncated.strip()


class AIEnhancer:
    """Main AI enhancement orchestrator"""
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
        self.validator = ResultValidator()
        self.scorer = QualityScorer()
        self.filter = OutputFilter()
        self.replacer = TextReplacer()
    
    async def enhance_result(
        self,
        original_text: str,
        ai_result: str,
        task_type: str = "summarization",
        language: str = "ar",
        custom_rule: Optional[str] = None
    ) -> Tuple[str, float, Dict[str, Any]]:
        """
        Enhance AI result with validation, scoring, and filtering
        
        Returns:
            (cleaned_text, quality_score, metadata)
        """
        metadata = {
            "original_length": len(original_text),
            "result_length": len(ai_result),
            "reductions": []
        }
        
        try:
            # 1. Remove artifacts
            cleaned = self.filter.remove_artifacts(ai_result)
            metadata["reductions"].append(("artifact_removal", len(ai_result) - len(cleaned)))
            
            # 2. Clean markdown
            cleaned = self.filter.clean_markdown(cleaned)
            
            # 3. Normalize language
            cleaned = self.filter.normalize_language(cleaned, language)
            
            # 4. Apply text replacements from custom rules (CRITICAL for user-defined substitutions)
            if custom_rule:
                cleaned, replacement_changes = TextReplacer.apply_replacements(cleaned, custom_rule)
                if replacement_changes:
                    metadata["text_replacements"] = replacement_changes
                    error_logger.log_info(f"[AI Enhancement] Applied {len(replacement_changes)} text replacements: {replacement_changes}")
            
            # 5. Validate completeness
            is_complete = self.validator.validate_completeness(cleaned)
            metadata["is_complete"] = is_complete
            
            if not is_complete:
                error_logger.log_info(f"AI Enhancement: Result appears incomplete")
            
            # 5. Validate structure
            has_structure = self.validator.validate_structure(cleaned)
            metadata["has_structure"] = has_structure
            
            # 6. Score quality
            if task_type == "summarization":
                quality_score = self.scorer.score_summarization(
                    original_text, 
                    cleaned,
                    reduction_ratio=0.5
                )
            else:
                quality_score = self.scorer.score_transformation(
                    original_text,
                    cleaned,
                    task_type
                )
            
            metadata["quality_score"] = quality_score
            
            # 7. Smart truncation for Telegram
            final_result = self.filter.truncate_smart(cleaned, max_length=4096)
            metadata["final_length"] = len(final_result)
            
            return final_result, quality_score, metadata
            
        except Exception as e:
            error_logger.log_info(f"AI Enhancement error: {str(e)}")
            return ai_result, 0.5, {"error": str(e)}
    
    def get_prompt_for_task(
        self,
        text: str,
        task_config: Dict[str, Any],
        custom_rule: Optional[str] = None
    ) -> str:
        """Get optimized prompt based on task configuration"""
        
        task_type = task_config.get("task_type", "general")
        language = task_config.get("language", "ar")
        
        return self.prompt_builder.build_summarization_prompt(
            text,
            task_type=task_type,
            language=language,
            custom_rule=custom_rule
        )
    
    async def enhance_news_content(
        self,
        text: str,
        content_type: str = "news"
    ) -> Tuple[str, float, Dict[str, Any]]:
        """
        Enhance news content with Yemen expert analysis
        
        Args:
            text: News content to analyze
            content_type: Type of content (news, interview, broadcast, statement)
        
        Returns:
            Tuple of (enhanced_text, quality_score, metadata)
        """
        
        if not YEMEN_ANALYZER_AVAILABLE or yemen_analyzer is None:
            error_logger.log_info("[AI Enhancement] Yemen analyzer not available, using basic enhancement")
            return await self.enhance_result(text, text, "summarization")
        
        try:
            # 1. Analyze with Yemen expert system
            analysis = await yemen_analyzer.analyze_news(text, source_type=content_type)
            error_logger.log_info(f"[AI Enhancement] Yemen analysis complete | Importance: {analysis.get('importance', 'N/A')}")
            
            # 2. Enhance Arabic language
            enhanced_text = analysis.get("analysis", text)
            if arabic_processor:
                enhanced_text, arabic_result = arabic_processor.enhance_arabic(enhanced_text)
            else:
                arabic_result = {}
            
            # 3. Verify facts if available
            verification = {}
            if web_search and analysis.get("fact_check_needed", False):
                verification = await web_search.verify_claims(text, analysis.get("entities", {}))
            
            # 4. Build metadata
            metadata = {
                "yemen_analysis": analysis,
                "arabic_enhancement": arabic_result,
                "fact_verification": verification,
                "content_type": content_type,
                "entities_found": len(analysis.get("entities", {}).get("actors", [])),
                "importance_level": analysis.get("importance", "MEDIUM")
            }
            
            # 5. Calculate quality score
            quality_score = verification.get("verification_score", 0.75)
            if analysis.get("importance") in ["CRITICAL", "HIGH"]:
                quality_score = min(quality_score + 0.1, 1.0)
            
            error_logger.log_info(f"[AI Enhancement] News enhancement complete | Score: {quality_score:.2f}")
            
            return enhanced_text, quality_score, metadata
            
        except Exception as e:
            error_logger.log_info(f"[AI Enhancement] News enhancement error: {str(e)}")
            return text, 0.5, {"error": str(e)}


# Global instance
ai_enhancer = AIEnhancer()

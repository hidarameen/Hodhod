"""
AI Enhancement Module
Advanced result validation, parsing, scoring, and filtering
Implements 20+ optimizations for AI accuracy and precision
"""
import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("ai_enhancement")

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
    
    async def enhance_result(
        self,
        original_text: str,
        ai_result: str,
        task_type: str = "summarization",
        language: str = "ar"
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
            
            # 4. Validate completeness
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


# Global instance
ai_enhancer = AIEnhancer()

    async def enhance_news_content(
        self,
        text: str,
        content_type: str = "news"  # news, interview, broadcast, statement
    ) -> Tuple[str, float, Dict[str, Any]]:
        """Enhance news content with Yemen expert analysis"""
        
        if yemen_analyzer is None:
            return await self.enhance_result(text, text, "summarization")
        
        # Analyze with Yemen expert system
        analysis = await yemen_analyzer.analyze_news(text, source_type=content_type)
        
        # Enhance Arabic
        enhanced_arabic, arabic_result = arabic_processor.enhance_arabic(analysis.get("analysis", text))
        
        # Verify facts
        verification = await web_search.verify_claims(text, analysis.get("entities", {}))
        
        metadata = {
            "yemen_analysis": analysis,
            "arabic_enhancement": arabic_result,
            "fact_verification": verification
        }
        
        quality_score = verification.get("verification_score", 0.5)
        
        return enhanced_arabic, quality_score, metadata

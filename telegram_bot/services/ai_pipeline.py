"""
AI Processing Pipeline
Unified 4-stage AI processing system
Stage 1: Preprocessing (Entity extraction, sentiment analysis)
Stage 2: Rule Engine (Entity replacement, context neutralization)
Stage 3: AI Summarization (Enhanced prompts with rules)
Stage 4: Postprocessing (Validation, verification, formatting)
"""
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from utils.error_handler import ErrorLogger
from utils.database import db
from services.ai_preprocessing import preprocessing_engine, PreprocessingResult
from services.ai_rule_engine import rule_engine, RuleEngineResult
from services.ai_postprocessing import postprocessing_engine, PostprocessingResult

error_logger = ErrorLogger("ai_pipeline")

@dataclass
class PipelineStageResult:
    """Result from a single pipeline stage"""
    stage_name: str
    input_text: str
    output_text: str
    processing_time: float
    success: bool
    details: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

@dataclass
class PipelineResult:
    """Complete pipeline processing result"""
    original_text: str
    final_text: str
    stages: List[PipelineStageResult]
    preprocessing: Optional[PreprocessingResult] = None
    rule_engine: Optional[RuleEngineResult] = None
    postprocessing: Optional[PostprocessingResult] = None
    total_time: float = 0.0
    quality_score: float = 1.0
    success: bool = True
    rules_applied_count: int = 0
    entities_replaced: Dict[str, List[Tuple[str, str]]] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

class AIPipeline:
    """
    Main AI Processing Pipeline
    Orchestrates all 4 stages of AI text processing
    """
    
    def __init__(self):
        self.preprocessing = preprocessing_engine
        self.rule_engine = rule_engine
        self.postprocessing = postprocessing_engine
        self.ai_manager = None
        error_logger.log_info("[Pipeline] AI Processing Pipeline initialized")
    
    def set_ai_manager(self, ai_manager):
        """Set the AI manager for text generation"""
        self.ai_manager = ai_manager
    
    async def process(
        self,
        text: str,
        task_id: int,
        provider: str,
        model: str,
        system_prompt: Optional[str] = None,
        custom_rules: Optional[List[Dict]] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> PipelineResult:
        """
        Main pipeline processing function
        Executes all 4 stages in order
        """
        start_time = datetime.now()
        config = config or await self._get_config(task_id)
        
        if not text or not text.strip():
            return self._empty_result(text)
        
        stages = []
        warnings = []
        errors = []
        current_text = text.strip()
        
        error_logger.log_info(f"[Pipeline] Starting processing | Task: {task_id} | Text length: {len(current_text)}")
        
        stage_start = datetime.now()
        preprocessing_result = await self.preprocessing.process(current_text, config)
        stage_time = (datetime.now() - stage_start).total_seconds()
        
        stages.append(PipelineStageResult(
            stage_name='preprocessing',
            input_text=current_text[:100],
            output_text=preprocessing_result.cleaned_text[:100],
            processing_time=stage_time,
            success=True,
            details={
                'entities_found': len(preprocessing_result.entities),
                'sentiment': preprocessing_result.sentiment.overall,
                'keywords': len(preprocessing_result.keywords),
                'language': preprocessing_result.language
            }
        ))
        
        error_logger.log_info(f"[Pipeline] Stage 1 complete | Entities: {len(preprocessing_result.entities)} | Sentiment: {preprocessing_result.sentiment.overall}")
        
        stage_start = datetime.now()
        rule_result = await self.rule_engine.process(
            current_text,
            task_id,
            preprocessing_result
        )
        stage_time = (datetime.now() - stage_start).total_seconds()
        
        current_text = rule_result.processed_text
        
        stages.append(PipelineStageResult(
            stage_name='rule_engine',
            input_text=text[:100],
            output_text=current_text[:100],
            processing_time=stage_time,
            success=rule_result.success,
            details={
                'rules_applied': len(rule_result.rules_applied),
                'replacements': rule_result.total_replacements,
                'context_mods': len(rule_result.context_modifications)
            },
            error='; '.join(rule_result.errors) if rule_result.errors else None
        ))
        
        warnings.extend(rule_result.errors)
        
        error_logger.log_info(f"[Pipeline] Stage 2 complete | Rules: {len(rule_result.rules_applied)} | Replacements: {rule_result.total_replacements}")
        
        stage_start = datetime.now()
        ai_output = await self._process_with_ai(
            current_text,
            task_id,
            provider,
            model,
            system_prompt,
            custom_rules,
            preprocessing_result,
            rule_result,
            config
        )
        stage_time = (datetime.now() - stage_start).total_seconds()
        
        if ai_output and ai_output.strip():
            stages.append(PipelineStageResult(
                stage_name='ai_summarization',
                input_text=current_text[:100],
                output_text=ai_output[:100],
                processing_time=stage_time,
                success=True,
                details={
                    'provider': provider,
                    'model': model,
                    'input_length': len(current_text),
                    'output_length': len(ai_output)
                }
            ))
            current_text = ai_output
        else:
            stages.append(PipelineStageResult(
                stage_name='ai_summarization',
                input_text=current_text[:100],
                output_text=current_text[:100],
                processing_time=stage_time,
                success=False,
                error='AI returned empty response'
            ))
            warnings.append('AI summarization failed, using rule-processed text')
        
        error_logger.log_info(f"[Pipeline] Stage 3 complete | Output length: {len(current_text)}")
        
        stage_start = datetime.now()
        postprocess_result = await self.postprocessing.process(
            current_text,
            text,
            rule_result,
            config
        )
        stage_time = (datetime.now() - stage_start).total_seconds()
        
        final_text = postprocess_result.final_output
        
        stages.append(PipelineStageResult(
            stage_name='postprocessing',
            input_text=current_text[:100],
            output_text=final_text[:100],
            processing_time=stage_time,
            success=postprocess_result.success,
            details={
                'validations': len(postprocess_result.validations),
                'rules_verified': sum(1 for v in postprocess_result.rules_verified.values() if v),
                'quality_score': postprocess_result.quality_score
            }
        ))
        
        warnings.extend(postprocess_result.warnings)
        errors.extend(postprocess_result.errors)
        
        error_logger.log_info(f"[Pipeline] Stage 4 complete | Quality: {postprocess_result.quality_score:.2f}")
        
        total_time = (datetime.now() - start_time).total_seconds()
        
        result = PipelineResult(
            original_text=text,
            final_text=final_text,
            stages=stages,
            preprocessing=preprocessing_result,
            rule_engine=rule_result,
            postprocessing=postprocess_result,
            total_time=total_time,
            quality_score=postprocess_result.quality_score,
            success=all(s.success for s in stages),
            rules_applied_count=len(rule_result.rules_applied),
            entities_replaced=rule_result.entities_replaced,
            warnings=warnings,
            errors=errors
        )
        
        error_logger.log_info(
            f"[Pipeline] ✅ Complete | Total time: {total_time:.2f}s | "
            f"Quality: {postprocess_result.quality_score:.2f} | "
            f"Original: {len(text)} → Final: {len(final_text)} chars"
        )
        
        return result
    
    async def _process_with_ai(
        self,
        text: str,
        task_id: int,
        provider: str,
        model: str,
        system_prompt: Optional[str],
        custom_rules: Optional[List[Dict]],
        preprocessing_result: PreprocessingResult,
        rule_result: RuleEngineResult,
        config: Dict[str, Any]
    ) -> str:
        """
        Stage 3: Process text with AI
        Builds enhanced prompt with context from preprocessing and rules
        """
        if not self.ai_manager:
            from services.ai_providers import ai_manager
            self.ai_manager = ai_manager
        
        enhanced_prompt = self._build_enhanced_prompt(
            text,
            system_prompt,
            custom_rules,
            preprocessing_result,
            rule_result,
            config
        )
        
        temperature = float(config.get('temperature', '0.7'))
        quality = config.get('quality_level', 'balanced')
        
        if quality == 'fast':
            max_tokens = min(500, len(text) // 2)
        elif quality == 'high_quality':
            max_tokens = max(1000, len(text))
        else:
            max_tokens = max(500, len(text) // 2)
        
        try:
            result = await self.ai_manager.generate(
                provider=provider,
                model=model,
                prompt=enhanced_prompt,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return result or ""
        except Exception as e:
            error_logger.log_warning(f"[Pipeline] AI generation failed: {str(e)}")
            return ""
    
    def _build_enhanced_prompt(
        self,
        text: str,
        system_prompt: Optional[str],
        custom_rules: Optional[List[Dict]],
        preprocessing_result: PreprocessingResult,
        rule_result: RuleEngineResult,
        config: Dict[str, Any]
    ) -> str:
        """
        Build enhanced prompt with all context and rules
        """
        prompt_parts = []
        
        base_prompt = system_prompt or """أنت محرر إخباري محترف متخصص في تلخيص الأخبار والتقارير السياسية.
مهمتك: تلخيص النص التالي بشكل موجز ودقيق مع الحفاظ على:
- جميع الأسماء والكيانات كما وردت في النص
- الحياد والموضوعية
- الصياغة الرسمية والمهنية"""
        
        prompt_parts.append(base_prompt)
        
        if custom_rules:
            rules_text = "\n\nالقواعد الإلزامية التي يجب اتباعها:"
            for i, rule in enumerate(custom_rules, 1):
                rule_prompt = rule.get('prompt', '')
                if rule_prompt:
                    rules_text += f"\n{i}. {rule_prompt}"
            prompt_parts.append(rules_text)
        
        if rule_result.entities_replaced:
            entity_instructions = "\n\nتعليمات خاصة بالأسماء والكيانات:"
            for entity_type, replacements in rule_result.entities_replaced.items():
                for original, replacement in replacements:
                    entity_instructions += f"\n- استخدم '{replacement}' وليس '{original}'"
            prompt_parts.append(entity_instructions)
        
        # Add context rules instructions for AI processing
        if hasattr(rule_result, 'ai_instructions') and rule_result.ai_instructions:
            context_instructions = "\n\nتعليمات السياق والتحرير (يجب اتباعها):"
            for i, inst in enumerate(rule_result.ai_instructions, 1):
                instructions_text = inst.get('instructions', '')
                rule_type = inst.get('rule_type', '')
                target_sentiment = inst.get('target_sentiment', 'neutral')
                if instructions_text:
                    context_instructions += f"\n{i}. {instructions_text}"
                    if target_sentiment != 'neutral':
                        context_instructions += f" (الهدف: {target_sentiment})"
            prompt_parts.append(context_instructions)
            error_logger.log_info(f"[Pipeline] Added {len(rule_result.ai_instructions)} context instructions to prompt")
        
        if preprocessing_result.sentiment.has_offensive:
            prompt_parts.append("\n\nملاحظة: النص يحتوي على لغة قد تكون غير مناسبة. يرجى تحييدها وجعل الصياغة محايدة.")
        
        preserve_format = config.get('preserve_formatting', True)
        output_format = config.get('output_format', 'markdown')
        
        format_instructions = "\n\nتعليمات التنسيق:"
        if output_format == 'markdown':
            format_instructions += "\n- استخدم التنسيق Markdown عند الحاجة"
            format_instructions += "\n- استخدم العناوين والنقاط لتنظيم المحتوى"
        elif output_format == 'plain':
            format_instructions += "\n- أخرج نصاً عادياً بدون تنسيق"
        
        format_instructions += "\n- لا تبدأ بكلمة 'ملخص' أو 'Summary'"
        format_instructions += "\n- لا تذكر أنك نموذج ذكاء اصطناعي"
        
        prompt_parts.append(format_instructions)
        
        prompt_parts.append(f"\n\n--- النص المطلوب تلخيصه ---\n{text}")
        
        return "\n".join(prompt_parts)
    
    async def _get_config(self, task_id: int) -> Dict[str, Any]:
        """Get processing configuration for task"""
        try:
            config = await db.get_processing_config(task_id)
            if config:
                return config
        except Exception as e:
            error_logger.log_info(f"[Pipeline] No custom config for task {task_id}, using defaults")
        
        return {
            'enable_entity_extraction': True,
            'enable_sentiment_analysis': True,
            'enable_keyword_detection': True,
            'enable_output_validation': True,
            'enable_rule_verification': True,
            'preserve_formatting': True,
            'output_format': 'markdown',
            'temperature': '0.7',
            'quality_level': 'balanced'
        }
    
    def _empty_result(self, text: str) -> PipelineResult:
        """Return empty result for empty text"""
        return PipelineResult(
            original_text=text or "",
            final_text=text or "",
            stages=[],
            success=True
        )
    
    async def process_video_summary(
        self,
        transcript: str,
        task_id: int,
        provider: str,
        model: str,
        config: Optional[Dict[str, Any]] = None
    ) -> PipelineResult:
        """
        Process video transcript with specialized video summarization
        """
        video_system_prompt = """أنت محرر فيديو محترف متخصص في تلخيص محتوى الفيديوهات.
مهمتك: تلخيص محتوى الفيديو بشكل موجز ودقيق مع:
- التركيز على النقاط الرئيسية
- ذكر المتحدثين الرئيسيين إن وجدوا
- تلخيص الأحداث المهمة بترتيب زمني
- الحفاظ على السياق العام للفيديو"""
        
        video_rules = await db.get_task_rules(task_id)
        video_rules = [r for r in video_rules if r.get('type') == 'video_summarize' and r.get('is_active')]
        
        return await self.process(
            text=transcript,
            task_id=task_id,
            provider=provider,
            model=model,
            system_prompt=video_system_prompt,
            custom_rules=video_rules,
            config=config
        )

ai_pipeline = AIPipeline()

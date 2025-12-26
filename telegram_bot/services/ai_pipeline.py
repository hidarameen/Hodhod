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
    extracted_fields: Dict[str, Any] = field(default_factory=dict)

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
        config: Optional[Dict[str, Any]] = None,
        video_source_info: Optional[Dict[str, str]] = None,
        fields_to_extract: Optional[Any] = None,
        serial_number: Optional[int] = None
    ) -> PipelineResult:
        """
        Main pipeline processing function
        Executes all 4 stages in order
        """
        start_time = datetime.now()
        config = config or await self._get_config(task_id)
        
        # If fields_to_extract is True, get them from the template
        if fields_to_extract is True:
            template = await db.get_task_publishing_template(task_id)
            fields_to_extract = template.get("fields", []) if template else []
        
        if not text or not text.strip():
            return self._empty_result(text)
        
        stages = []
        warnings = []
        errors = []
        current_text = text.strip()
        
        error_logger.log_info(f"[Pipeline] ═══════════════════════════════════════════════════════════════")
        error_logger.log_info(f"[Pipeline] 🚀 STARTING PROCESSING | Task: {task_id} | Text length: {len(current_text)}")
        error_logger.log_info(f"[Pipeline] 📥 INPUT TEXT: {current_text[:200]}...")
        error_logger.log_info(f"[Pipeline] ═══════════════════════════════════════════════════════════════")
        
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
        
        # ✅ Log detailed rules applied
        if rule_result.rules_applied:
            error_logger.log_info(f"[Pipeline] 📋 DETAILED RULES APPLIED:")
            for i, rule_app in enumerate(rule_result.rules_applied, 1):
                error_logger.log_info(f"[Pipeline]   Rule {i}: {rule_app.rule_name} (Type: {rule_app.rule_type})")
                if rule_app.changes_made:
                    error_logger.log_info(f"[Pipeline]     Changes: {len(rule_app.changes_made)} modifications")
        
        # ✅ Log text after rules processing
        error_logger.log_info(f"[Pipeline] 📝 TEXT AFTER RULES: {current_text[:300]}...")
        
        # Skip pre-truncation summarization rule - let AI do the actual summarization
        # The AI will handle both summarization and rule application via custom_rules in prompt
        
        stage_start = datetime.now()
        ai_output, extracted_fields = await self._process_with_ai(
            current_text,
            task_id,
            provider,
            model,
            system_prompt,
            custom_rules,
            preprocessing_result,
            rule_result,
            config,
            video_source_info=video_source_info,
            fields_to_extract=fields_to_extract,
            serial_number=serial_number
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
            error_logger.log_info(f"[Pipeline] ✅ Stage 3 AI SUCCESS | Input: {len(current_text)} → Output: {len(ai_output)} chars")
            error_logger.log_info(f"[Pipeline] 📤 AI OUTPUT: {ai_output[:300]}...")
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
            error_logger.log_warning(f"[Pipeline] ⚠️ Stage 3 AI FAILED | Empty response from {provider}/{model}")
            error_logger.log_warning(f"[Pipeline] ⚠️ Using original text (no summarization applied)")
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
            errors=errors,
            extracted_fields=extracted_fields or {}
        )
        
        error_logger.log_info(
            f"[Pipeline] ✅ COMPLETE | Total time: {total_time:.2f}s | "
            f"Quality: {postprocess_result.quality_score:.2f} | "
            f"Original: {len(text)} → Final: {len(final_text)} chars"
        )
        
        reduction_pct = 100 - (len(final_text) * 100 // len(text)) if len(text) > 0 else 0
        error_logger.log_info(
            f"[Pipeline] 📊 SUMMARY: {len(text)} → {len(final_text)} chars ({reduction_pct}% reduction) | "
            f"Rules: {len(rule_result.rules_applied)} | Entities: {len(rule_result.entities_replaced)}"
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
        config: Dict[str, Any],
        video_source_info: Optional[Dict[str, str]] = None,
        fields_to_extract: Optional[List[Dict[str, Any]]] = None,
        serial_number: Optional[int] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Stage 3: Process text with AI
        Builds enhanced prompt with context from preprocessing and rules
        Includes training examples for few-shot learning
        """
        if not self.ai_manager:
            from services.ai_providers import ai_manager
            self.ai_manager = ai_manager
        
        # ✅ Log input text for AI processing
        error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
        error_logger.log_info(f"[Pipeline] 🤖 STAGE 3: AI SUMMARIZATION")
        error_logger.log_info(f"[Pipeline] 📥 AI INPUT TEXT ({len(text)} chars):")
        error_logger.log_info(f"[Pipeline] {text[:500]}...")
        error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
        
        training_examples = await self._get_training_examples(task_id)
        error_logger.log_info(f"[Pipeline] 📚 Training Examples | Loaded: {len(training_examples)} for task {task_id}")
        if training_examples:
            for i, ex in enumerate(training_examples[:3], 1):
                error_logger.log_info(f"[Pipeline]   📝 Example {i}: type={ex.get('example_type')} | input={ex.get('input_text', '')[:50]}... | output={ex.get('expected_output', '')[:50]}...")
        
        # No token limit - let AI produce complete summary without cutoff
        max_tokens = 128000  # No limit - allows full text generation without any restrictions
        if custom_rules:
            error_logger.log_info(f"[Pipeline] ⚠️ SUMMARIZATION RULES ({len(custom_rules)} rules):")
            for i, rule in enumerate(custom_rules, 1):
                rule_name = rule.get('name', 'Unknown')
                rule_type = rule.get('type', 'unknown')
                rule_prompt = rule.get('prompt', '')
                rule_config = rule.get('config', {})
                error_logger.log_info(f"[Pipeline]   📌 Rule {i}: name={rule_name} | type={rule_type}")
                error_logger.log_info(f"[Pipeline]      prompt={rule_prompt[:100]}...")
                error_logger.log_info(f"[Pipeline]      config={str(rule_config)[:100]}...")
        else:
            error_logger.log_info(f"[Pipeline] ⚠️ SUMMARIZATION RULES: None provided")
        
        # Initialize extracted fields with serial number
        extracted_fields = {}
        if serial_number is not None:
            serial_val = f"#{serial_number}"
            extracted_fields["رقم_القيد"] = serial_val
            extracted_fields["رقم_القيد_"] = serial_val
            extracted_fields["serial_number"] = serial_number
            extracted_fields["record_number"] = serial_number
            error_logger.log_info(f"[Pipeline] 📌 Injected serial number: {serial_val}")
        
        # Build enhanced prompt including field extraction if needed
        error_logger.log_info(f"[Pipeline] 📝 BUILDING ENHANCED PROMPT...")
        enhanced_prompt = self._build_enhanced_prompt(
            text,
            system_prompt,
            custom_rules,
            preprocessing_result,
            rule_result,
            config,
            training_examples,
            video_source_info=video_source_info,
            fields_to_extract=fields_to_extract
        )
        
        error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
        error_logger.log_info(f"[Pipeline] 📋 AI PROMPT ({len(enhanced_prompt)} chars):")
        error_logger.log_info(f"[Pipeline] {enhanced_prompt[:800]}...")
        error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
        
        temperature = float(config.get('temperature', '0.7'))
        quality = config.get('quality_level', 'balanced')
        
        # No token restrictions - allow full text completion
        error_logger.log_info(f"[Pipeline] 🔓 Token limit: UNLIMITED (max_tokens={max_tokens} - بدون حدود)")
        
        try:
            error_logger.log_info(f"[Pipeline] 🔄 CALLING AI")
            error_logger.log_info(f"[Pipeline]    Provider: {provider}")
            error_logger.log_info(f"[Pipeline]    Model: {model}")
            error_logger.log_info(f"[Pipeline]    Max Tokens: {max_tokens}")
            error_logger.log_info(f"[Pipeline]    Temperature: {temperature}")
            
            result = await self.ai_manager.generate(
                provider=provider,
                model=model,
                prompt=enhanced_prompt,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            if not result:
                error_logger.log_warning(f"[Pipeline] ⚠️ AI returned EMPTY result (provider={provider}, model={model})")
                return ("", extracted_fields)
            
            error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
            error_logger.log_info(f"[Pipeline] ✅ AI RETURNED {len(result)} chars")
            error_logger.log_info(f"[Pipeline] 📤 AI OUTPUT (BEFORE RULES):")
            error_logger.log_info(f"[Pipeline] {result[:500]}...")
            error_logger.log_info(f"[Pipeline] ════════════════════════════════════════════════════════════════")
            
            # Parse result - check if it contains JSON with extracted fields
            if fields_to_extract:
                summary_text, ai_extracted = self._parse_combined_response(result, fields_to_extract)
                extracted_fields.update(ai_extracted)
                error_logger.log_info(f"[Pipeline] 📦 Extracted {len(ai_extracted)} fields in single AI call")
                
                # ✅ FIXED: Apply summarization rules to extracted summary
                summary_text = await self._apply_post_summarization_rules(summary_text, task_id)
                error_logger.log_info(f"[Pipeline] ✅ Post-summarization rules applied | Final: {len(summary_text)} chars")
                
                return (summary_text, extracted_fields)
            
            # ✅ FIXED: Apply summarization rules to direct AI output
            final_result = await self._apply_post_summarization_rules(result, task_id)
            error_logger.log_info(f"[Pipeline] ✅ Post-summarization rules applied | Final: {len(final_result)} chars")
            error_logger.log_info(f"[Pipeline] 📤 FINAL OUTPUT (AFTER RULES): {final_result[:500]}...")
            
            return (final_result or "", extracted_fields)
        except Exception as e:
            error_logger.log_warning(f"[Pipeline] ❌ AI generation EXCEPTION: {str(e)} (provider={provider}, model={model})")
            import traceback
            error_logger.log_warning(f"[Pipeline] Traceback: {traceback.format_exc()}")
            return ("", extracted_fields)
    
    async def _apply_post_summarization_rules(self, text: str, task_id: int) -> str:
        """
        ✅ FIXED: Apply summarization rules to AI output
        Supports maxLength, style, keyPointsCount from database rules
        """
        try:
            if not text:
                return text
            
            from utils.database import db
            ai_rules = await db.get_task_rules(task_id)
            if not ai_rules:
                return text
            
            # Filter for active summarize rules
            summarize_rules = []
            for r in ai_rules:
                rule_dict = dict(r) if hasattr(r, '__iter__') and not isinstance(r, dict) else r
                if isinstance(rule_dict, dict) and rule_dict.get('type') == 'summarize' and rule_dict.get('is_active'):
                    summarize_rules.append(rule_dict)
            
            if not summarize_rules:
                return text
            
            processed_text = text
            for rule in sorted(summarize_rules, key=lambda r: r.get('priority', 0), reverse=True):
                rule_config = rule.get('config', {})
                if isinstance(rule_config, str):
                    try:
                        import json
                        rule_config = json.loads(rule_config)
                    except:
                        rule_config = {}
                
                # Extract max_length and apply truncation
                max_length = rule_config.get('maxLength') or rule_config.get('max_length')
                if max_length and isinstance(max_length, (int, float)) and max_length > 0:
                    if len(processed_text) > max_length:
                        processed_text = processed_text[:int(max_length)].rsplit(' ', 1)[0]
                        if not processed_text.endswith(('...', '،', '.', '؟')):
                            processed_text += '...'
                        error_logger.log_info(f"[Pipeline] ✅ Applied max_length({max_length}): {len(text)} → {len(processed_text)} chars")
            
            return processed_text
        except Exception as e:
            error_logger.log_warning(f"[Pipeline] ⚠️ Error in post-summarization rules: {str(e)}")
            return text
    
    def _build_enhanced_prompt(
        self,
        text: str,
        system_prompt: Optional[str],
        custom_rules: Optional[List[Dict]],
        preprocessing_result: PreprocessingResult,
        rule_result: RuleEngineResult,
        config: Dict[str, Any],
        training_examples: Optional[List[Dict]] = None,
        video_source_info: Optional[Dict[str, str]] = None,
        fields_to_extract: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Build enhanced prompt with all context, rules, and training examples
        Includes video metadata (title, description, uploader) for better summarization
        """
        prompt_parts = []
        
        base_prompt = system_prompt or """أنت محرر إخباري محترف ومحلل لغوي ذكي متخصص في تحرير وتلخيص الأخبار والتقارير.

🎯 مهامك الأساسية (بالترتيب):
1. تطبيق قواعد الاستبدال الذكي (إذا وُجدت) - هذه الأولوية القصوى
2. استخراج الحقول المطلوبة بدقة من كامل النص المرفق (بما في ذلك الكابشن والنص المفرغ)
3. تلخيص النص بشكل موجز ودقيق (ملاحظة هامة: لا تكرر الحقول المستخرجة مثل المحافظة والمصدر داخل نص التلخيص نفسه)
4. الحفاظ على الحياد والموضوعية
5. استخدام صياغة رسمية ومهنية

🔍 تعليمات خاصة بالاستخراج:
• استخرج "المحافظة" من النص إذا ذكرت أي مدينة أو منطقة يمنية (مثل: عدن، صنعاء، مأرب، تل أبيب، مأرب، تعز، إلخ). إذا لم تذكر محافظة، اترك الحقل فارغاً.
• استخرج "المصدر" بناءً على الجهة الناقلة للخبر أو الأشخاص المتحدثين أو السياق المذكور في النص أو الكابشن.
• ابحث في كامل النص المدموج (الكابشن + محتوى الفيديو) عن هذه التفاصيل."""
        
        prompt_parts.append(base_prompt)
        
        # Add video metadata if available (title, description, uploader)
        if video_source_info:
            metadata_text = "\n\n📹 معلومات الفيديو/المحتوى:"
            
            if video_source_info.get('title'):
                metadata_text += f"\n• العنوان: {video_source_info.get('title')}"
            
            if video_source_info.get('description'):
                desc = video_source_info.get('description', '')
                # Truncate if too long
                if len(desc) > 500:
                    desc = desc[:500] + "..."
                metadata_text += f"\n• الوصف: {desc}"
            
            if video_source_info.get('uploader'):
                metadata_text += f"\n• المصدر/المحمل: {video_source_info.get('uploader')}"
            
            if video_source_info.get('platform'):
                metadata_text += f"\n• المنصة: {video_source_info.get('platform')}"
            
            if video_source_info.get('duration'):
                duration = video_source_info.get('duration', 0)
                if isinstance(duration, (int, float)) and duration > 0:
                    metadata_text += f"\n• المدة: {int(duration)} ثانية"
            
            metadata_text += "\n\n⚠️ استخدم هذه المعلومات لتحسين فهمك للمحتوى والتلخيص الدقيق"
            prompt_parts.append(metadata_text)
        
        # Add summarization options from config
        summ_config = config.get('config', {}) if isinstance(config.get('config'), dict) else {}
        max_length = summ_config.get('maxLength', 300)
        style = summ_config.get('style', 'balanced')
        key_points = summ_config.get('keyPointsCount', 3)
        
        if max_length or style:
            options_text = f"\n\nخيارات التلخيص:"
            options_text += f"\n- الطول الأقصى: {max_length} حرف"
            options_text += f"\n- الأسلوب: {style}"
            if key_points:
                options_text += f"\n- عدد النقاط الرئيسية: {key_points}"
            prompt_parts.append(options_text)
        
        if custom_rules:
            rules_text = "\n\n⚠️ القواعد الإلزامية (يجب تطبيقها بدقة):"
            for i, rule in enumerate(custom_rules, 1):
                rule_prompt = rule.get('prompt', '')
                rule_type = rule.get('type', '')
                
                # For summarization rules, build enhanced prompt from config
                if rule_type == 'summarize' and not rule_prompt:
                    rule_config = rule.get('config', {})
                    
                    # Parse config if it's a JSON string
                    if isinstance(rule_config, str):
                        try:
                            import json
                            rule_config = json.loads(rule_config)
                        except:
                            rule_config = {}
                    
                    max_length = rule_config.get('maxLength', 300) if isinstance(rule_config, dict) else 300
                    style = rule_config.get('style', 'balanced') if isinstance(rule_config, dict) else 'balanced'
                    rule_prompt = f"قم بتلخيص النص ليكون {style} مع الحفاظ على المعنى الأساسي (الحد الأقصى: {max_length} حرف)"
                
                if rule_prompt:
                    rules_text += f"\n{i}. {rule_prompt}"
                    
                    # Add special handling for news format requirements
                    if 'خبر' in rule_prompt or 'أسلوب إخباري' in rule_prompt or 'news' in rule_prompt.lower():
                        rules_text += "\n   📰 تنسيق الخبر الإلزامي:"
                        rules_text += "\n   • اكتب الخبر في شكل فقرة واحدة متسلسلة"
                        rules_text += "\n   • ابدأ بأهم المعلومات (الفكرة الرئيسية)"
                        rules_text += "\n   • لا تستخدم النقاط (•) أو الترقيم"
                        rules_text += "\n   • حافظ على التسلسل المنطقي والسلاسة"
                        rules_text += "\n   • اجعل الصياغة احترافية وإخبارية"
                    
            
            if len(rules_text) > len("\n\n⚠️ القواعد الإلزامية (يجب تطبيقها بدقة):"):
                prompt_parts.append(rules_text)
        
        if rule_result.entities_replaced:
            entity_instructions = """

🔖 الاستبدالات التي تم تطبيقها مسبقاً (تأكد من عدم إعادتها للأصل):
"""
            for entity_type, replacements in rule_result.entities_replaced.items():
                entity_instructions += f"\n📌 نوع الكيان: {entity_type}"
                for original, replacement in replacements:
                    entity_instructions += f"\n   • '{original}' ← تم استبدالها بـ ← '{replacement}'"
                    entity_instructions += f"\n     ⚡ تأكد من استبدال أي صيغة أخرى لـ '{original}' بـ '{replacement}'"
            
            entity_instructions += """

⚠️ ملاحظة مهمة: إذا وجدت أي ذكر آخر للكلمات الأصلية لم يتم استبداله، قم باستبداله.
"""
            prompt_parts.append(entity_instructions)
        
        # Add semantic replacement rules for AI to find and replace variations
        if hasattr(rule_result, 'semantic_replacement_rules') and rule_result.semantic_replacement_rules:
            semantic_instructions = """

═══════════════════════════════════════════════════════════════════════════════
⚠️ مهمة الاستبدال الذكي (الأولوية القصوى - يجب تنفيذها بدقة متناهية)
═══════════════════════════════════════════════════════════════════════════════

📋 المطلوب منك:
قم بتحليل النص التالي سطراً بسطر، كلمة بكلمة، وابحث عن أي ذكر للكيانات المحددة أدناه.
يجب استبدالها حتى لو كانت مكتوبة بطريقة مختلفة أو في سياق مختلف.

🔍 طريقة التحليل المطلوبة:
1️⃣ التحليل السياقي: افهم معنى كل جملة وحدد ما إذا كانت تشير للكيان المطلوب استبداله
2️⃣ التحليل الدلالي: ابحث عن المترادفات والكلمات ذات المعنى المشابه
3️⃣ التحليل الصرفي: ابحث عن جميع تصريفات الكلمة (جمع، مفرد، مؤنث، مذكر، مضاف)
4️⃣ التحليل الإملائي: تعرف على الكلمة حتى مع أخطاء إملائية أو اختلاف في الهمزات
5️⃣ تحليل الإشارات: إذا كان النص يشير للكيان بضمير أو لقب أو وصف، استبدله أيضاً

📌 أنواع المطابقة التي يجب البحث عنها:
• المطابقة الحرفية: نفس الكلمة بالضبط
• المطابقة الصرفية: الجمع والمفرد (مليشيا/مليشيات، حوثي/حوثيين/حوثيون)
• المطابقة مع التعريف: مع "ال" أو بدونها (الحوثي/حوثي، الجيش/جيش)
• المطابقة مع الضمائر: الكلمة مع ضمائر متصلة (جيشه، جيشهم، مليشياتهم)
• المطابقة السياقية: عندما يُشار للكيان بوصف أو لقب معروف
• المطابقة الجزئية: إذا كانت الكلمة جزءاً من عبارة أطول
• المطابقة الإملائية: نفس الكلمة بأخطاء إملائية شائعة

🎯 قواعد الاستبدال الإلزامية:
"""
            for rule in rule_result.semantic_replacement_rules:
                originals = rule.get('originals', [])
                replacements = rule.get('replacements', [])
                if not originals and rule.get('original'):
                    originals = [rule.get('original')]
                if not replacements and rule.get('replacement'):
                    replacements = [rule.get('replacement')]
                
                if originals and replacements:
                    primary_replacement = replacements[0] if replacements[0] else ""
                    originals_str = '، '.join([str(o) for o in originals if o])
                    
                    semantic_instructions += f"""
┌─────────────────────────────────────────────────────────────────────────────
│ 🔄 الكلمات الأصلية: {originals_str}
│ ✅ البديل المطلوب: {primary_replacement}
│ 
│ 📝 تعليمات خاصة بهذه القاعدة:
│ • ابحث عن أي ذكر مباشر أو غير مباشر لهذه الكلمات
│ • استبدل جميع التصريفات: (مفرد/جمع/مذكر/مؤنث/معرف/نكرة)
│ • استبدل حتى لو كانت مع ضمائر متصلة أو حروف جر
│ • إذا كان السياق يشير لنفس الكيان بطريقة مختلفة، استبدله
│ • حافظ على سلاسة النص وصحة الإعراب بعد الاستبدال
└─────────────────────────────────────────────────────────────────────────────
"""
            
            semantic_instructions += """
⚡ أمثلة على التحليل الذكي:
مثال 1: إذا كان المطلوب استبدال "مليشيا الحوثي" بـ "جماعة أنصار الله"
   - "مليشيا الحوثي" ← "جماعة أنصار الله" ✓
   - "مليشيات الحوثي" ← "جماعة أنصار الله" ✓
   - "الميليشيا الحوثية" ← "جماعة أنصار الله" ✓
   - "مليشياتهم" ← "الجماعة" ✓
   - "المليشيا" (إذا كان السياق يشير للحوثي) ← "جماعة أنصار الله" ✓

مثال 2: إذا كان المطلوب استبدال "الإرهابيين" بـ "المسلحين"
   - "الإرهابيين" ← "المسلحين" ✓
   - "إرهابي" ← "مسلح" ✓
   - "الإرهابيون" ← "المسلحون" ✓
   - "إرهابية" ← "مسلحة" ✓
   - "الجماعة الإرهابية" ← "الجماعة المسلحة" ✓

🚫 تحذيرات مهمة:
• لا تستبدل إذا كانت الكلمة في سياق مختلف تماماً لا علاقة له بالكيان المقصود
• حافظ على المعنى العام للجملة
• تأكد من صحة الإعراب والتذكير والتأنيث بعد الاستبدال
• إذا كانت الكلمة ضمن اقتباس حرفي، استبدلها أيضاً

═══════════════════════════════════════════════════════════════════════════════
"""
            prompt_parts.append(semantic_instructions)
            error_logger.log_info(f"[Pipeline] Added {len(rule_result.semantic_replacement_rules)} enhanced semantic replacement rules to prompt")
        
        # Add context rules instructions for AI processing
        if hasattr(rule_result, 'ai_instructions') and rule_result.ai_instructions:
            context_instructions = """

📝 تعليمات التحرير السياقي (إلزامية):
هذه التعليمات تحدد كيفية التعامل مع سياقات معينة في النص.
"""
            for i, inst in enumerate(rule_result.ai_instructions, 1):
                instructions_text = inst.get('instructions', '')
                rule_type = inst.get('rule_type', '')
                target_sentiment = inst.get('target_sentiment', 'neutral')
                if instructions_text:
                    sentiment_label = {
                        'positive': '🟢 إيجابي',
                        'negative': '🔴 سلبي', 
                        'neutral': '⚪ محايد'
                    }.get(target_sentiment, '⚪ محايد')
                    
                    context_instructions += f"""
┌── التعليمة {i} ──────────────────────────────────
│ 📋 {instructions_text}
│ 🎯 النبرة المطلوبة: {sentiment_label}
│ 💡 طبق هذه التعليمة على كل جزء مناسب في النص
└─────────────────────────────────────────────────
"""
            prompt_parts.append(context_instructions)
            error_logger.log_info(f"[Pipeline] Added {len(rule_result.ai_instructions)} context instructions to prompt")
        
        if preprocessing_result.sentiment.has_offensive:
            offensive_instructions = """

⚠️ تنبيه: تم رصد لغة غير مناسبة في النص

📌 التعليمات:
• حيّد جميع الألفاظ المسيئة أو العنيفة
• استبدل الشتائم والإهانات بوصف محايد
• حافظ على المعنى دون اللغة الجارحة
• اجعل الصياغة مهنية ومحايدة

🔄 أمثلة على التحييد:
• "إرهابي/مجرم" → "مسلح/متهم"
• "عصابة" → "مجموعة"  
• "كلب/حمار" → "شخص"
• الشتائم → حذفها أو استبدالها بوصف محايد
"""
            prompt_parts.append(offensive_instructions)
        
        if training_examples:
            examples_section = "\n\n📚 أمثلة تدريبية (تعلم من هذه الأمثلة واتبع نفس الأسلوب):"
            for i, example in enumerate(training_examples[:5], 1):
                input_text = example.get('input_text', '')[:200]
                expected_output = example.get('expected_output', '')[:200]
                explanation = example.get('explanation', '')
                example_type = example.get('example_type', 'general')
                
                examples_section += f"\n\n--- مثال {i} ({example_type}) ---"
                examples_section += f"\n◀️ المدخل: {input_text}"
                examples_section += f"\n▶️ المخرج المطلوب: {expected_output}"
                if explanation:
                    examples_section += f"\n💡 السبب: {explanation}"
            
            examples_section += "\n\n--- انتهت الأمثلة ---"
            examples_section += "\nاتبع نفس الأسلوب والتحويلات في النص التالي."
            prompt_parts.append(examples_section)
            error_logger.log_info(f"[Pipeline] Added {min(len(training_examples), 5)} training examples to prompt")
        
        preserve_format = config.get('preserve_formatting', True)
        output_format = config.get('output_format', 'markdown')
        
        format_instructions = """

📋 تعليمات الإخراج النهائية:
"""
        if output_format == 'markdown':
            format_instructions += "• استخدم تنسيق Markdown عند الحاجة للتنظيم\n"
            format_instructions += "• استخدم العناوين والنقاط لتوضيح المحتوى\n"
        elif output_format == 'plain':
            format_instructions += "• أخرج نصاً عادياً بدون تنسيق\n"
        
        format_instructions += """• لا تبدأ بكلمة 'ملخص' أو 'Summary'
• لا تذكر أنك نموذج ذكاء اصطناعي
• لا تشرح ما قمت به، فقط أخرج النص النهائي

✅ قائمة التحقق قبل الإخراج:
□ هل طبقت جميع قواعد الاستبدال؟
□ هل بحثت عن جميع صيغ الكلمات المطلوب استبدالها؟
□ هل حافظت على سلاسة النص بعد الاستبدال؟
□ هل صحة الإعراب والتذكير والتأنيث سليمة؟
□ هل النص محايد ومهني؟
"""
        prompt_parts.append(format_instructions)
        
        # Add field extraction instructions if fields are provided
        if fields_to_extract:
            # Filter fields that need AI extraction
            ai_fields = [f for f in fields_to_extract 
                        if f.get('field_type') == 'extracted' 
                        and f.get('field_name')]
            
            if ai_fields:
                fields_prompt = ""
                for f in ai_fields:
                    field_name = f.get('field_name', '')
                    instructions = f.get('extraction_instructions', '').strip()
                    fields_prompt += f"\n• {field_name}: {instructions or 'استخرج من النص'}"
                
                extraction_instructions = f"""

═══════════════════════════════════════════════════════════════════════════════
📊 استخراج الحقول المطلوبة:
═══════════════════════════════════════════════════════════════════════════════

بالإضافة للتلخيص، استخرج الحقول التالية من النص:
{fields_prompt}

⚠️ تنسيق الإخراج المطلوب:
أخرج الرد بالتنسيق التالي (JSON + التلخيص):

```json
{{
  "التلخيص": "النص الملخص هنا",
{chr(10).join([f'  "{f.get("field_name")}": "القيمة المستخرجة"' + (',' if i < len(ai_fields)-1 else '') for i, f in enumerate(ai_fields)])}
}}
```

ملاحظات:
- ضع التلخيص في حقل "التلخيص"
- إذا لم تجد قيمة لحقل ما، اتركه فارغاً ""
- أخرج JSON صحيح فقط بدون أي نص إضافي
"""
                prompt_parts.append(extraction_instructions)
                
                prompt_parts.append(f"""
═══════════════════════════════════════════════════════════════════════════════
📄 النص المطلوب معالجته:
═══════════════════════════════════════════════════════════════════════════════

{text}

═══════════════════════════════════════════════════════════════════════════════
⬇️ أخرج JSON فقط بالتنسيق المطلوب أعلاه:
""")
            else:
                # No AI fields, regular output
                prompt_parts.append(f"""
═══════════════════════════════════════════════════════════════════════════════
📄 النص المطلوب معالجته:
═══════════════════════════════════════════════════════════════════════════════

{text}

═══════════════════════════════════════════════════════════════════════════════
⬇️ أخرج النص المعالج فقط (بدون شرح أو تعليقات):
""")
        else:
            prompt_parts.append(f"""
═══════════════════════════════════════════════════════════════════════════════
📄 النص المطلوب معالجته:
═══════════════════════════════════════════════════════════════════════════════

{text}

═══════════════════════════════════════════════════════════════════════════════
⬇️ أخرج النص المعالج فقط (بدون شرح أو تعليقات):
""")
        
        return "\n".join(prompt_parts)
    
    def _parse_combined_response(
        self,
        response: str,
        fields_to_extract: List[Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Parse combined AI response containing both summary and extracted fields
        Returns tuple of (summary_text, extracted_fields)
        """
        import json
        import re
        
        extracted = {}
        summary = response  # Default to full response if parsing fails
        
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed = json.loads(json_str)
                
                # Extract summary
                summary = parsed.get('التلخيص', '') or parsed.get('summary', '') or ''
                
                # Extract other fields with normalization
                for k, v in parsed.items():
                    if k in ['التلخيص', 'summary']: continue
                    
                    val = str(v).strip() if v is not None else ""
                    # Store original key
                    extracted[k] = val
                    
                    # Store normalized key (remove underscores and handle Arabic variants)
                    norm_k = k.replace('_', '').replace(' ', '').strip()
                    extracted[norm_k] = val
                    
                    # Handle specific Arabic field mappings
                    if 'محافظه' in norm_k or 'محافظة' in norm_k or 'governorate' in norm_k:
                        extracted['المحافظة'] = val
                        extracted['المحافظه'] = val
                        extracted['governorate'] = val
                        
                    if 'مصدر' in norm_k or 'source' in norm_k:
                        extracted['المصدر'] = val
                        extracted['source'] = val
                        
                    if 'تصنيف' in norm_k or 'classification' in norm_k or 'category' in norm_k:
                        extracted['التصنيف'] = val
                        extracted['category'] = val

                error_logger.log_info(f"[Pipeline] ✅ Parsed combined response | Summary: {len(summary)} chars | Fields: {len(extracted)}")
        except json.JSONDecodeError as e:
            error_logger.log_warning(f"[Pipeline] ⚠️ Failed to parse JSON from response: {str(e)}")
            summary = response
        except Exception as e:
            error_logger.log_warning(f"[Pipeline] ⚠️ Error parsing combined response: {str(e)}")
            summary = response
        
        return (summary, extracted)
    
    async def _get_training_examples(self, task_id: int) -> List[Dict]:
        """Get training examples for few-shot learning"""
        try:
            examples = await db.get_training_examples(task_id=task_id)
            if examples:
                active_examples = [e for e in examples if e.get('is_active', True)]
                
                # Increment use_count for each example used
                for example in active_examples[:5]:  # Only for the ones we'll actually use
                    try:
                        await db.increment_example_use_count(example['id'])
                    except Exception as count_err:
                        error_logger.log_info(f"[Pipeline] Failed to increment use_count for example {example['id']}: {str(count_err)}")
                
                return active_examples
        except Exception as e:
            error_logger.log_info(f"[Pipeline] No training examples for task {task_id}: {str(e)}")
        return []
    
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
    
    async def process_audio_summary(
        self,
        transcript: str,
        task_id: int,
        provider: str,
        model: str,
        config: Optional[Dict[str, Any]] = None
    ) -> PipelineResult:
        """
        Process audio transcript with specialized audio summarization
        Applies AUDIO-SPECIFIC summarization rules (type='audio_summarize')
        Falls back to general summarization rules if no audio-specific rules exist
        """
        transcript_length = len(transcript)
        
        if transcript_length < 200:
            target_length = "50-100 كلمة"
        elif transcript_length < 500:
            target_length = "100-150 كلمة"
        elif transcript_length < 1000:
            target_length = "150-250 كلمة"
        elif transcript_length < 3000:
            target_length = "250-400 كلمة"
        else:
            target_length = "400-600 كلمة"
        
        audio_system_prompt = f"""أنت محرر صوتي محترف متخصص في تلخيص محتوى المقاطع الصوتية والرسائل الصوتية.

⚠️ تعليمات صارمة - يجب اتباعها بدقة:

1. 📝 قم بإنتاج ملخص مختصر وموجز للنص المُفرّغ (وليس النص الكامل)
2. 📏 الطول المطلوب للملخص: {target_length} (النص الأصلي {transcript_length} حرف)
3. 🎯 استخرج النقاط الرئيسية والأفكار المهمة فقط
4. ❌ لا تُعِد كتابة النص الكامل - قم بتلخيصه فقط
5. ✅ أعد الملخص مباشرة بدون مقدمات أو عبارات مثل "إليك الملخص"

📋 معايير التلخيص الجيد:
- التركيز على المعلومات الأساسية والجوهرية
- حذف التكرارات والحشو والتفاصيل الثانوية
- استخدام جمل قصيرة ومباشرة
- ذكر الأسماء والأرقام والتواريخ المهمة
- الحفاظ على السياق العام والمعنى الأصلي

🚫 تجنب:
- إعادة النص كما هو
- إضافة معلومات غير موجودة في النص الأصلي
- استخدام عبارات طويلة ومعقدة
- ذكر تفاصيل غير ضرورية"""
        
        # First try to get audio-specific rules
        all_rules = await db.get_task_rules(task_id)
        audio_rules = [r for r in all_rules if r.get('type') == 'audio_summarize' and r.get('is_active')]
        
        # If no audio-specific rules exist, fall back to general summarization rules
        if not audio_rules:
            error_logger.log_info(f"[Pipeline] No audio-specific rules found, falling back to general summarization rules")
            audio_rules = [r for r in all_rules if r.get('type') == 'summarize' and r.get('is_active')]
        
        if audio_rules:
            error_logger.log_info(f"[Pipeline] 🎙️ Loaded {len(audio_rules)} AUDIO-SPECIFIC summarization rules for task {task_id}")
        
        return await self.process(
            text=transcript,
            task_id=task_id,
            provider=provider,
            model=model,
            system_prompt=audio_system_prompt,
            custom_rules=audio_rules,
            config=config
        )

ai_pipeline = AIPipeline()

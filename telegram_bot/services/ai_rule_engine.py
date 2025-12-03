"""
AI Rule Engine
Stage 2: Apply programmatic rules before AI processing
Handles entity replacement, context neutralization, sentiment adjustment
"""
import re
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from utils.error_handler import ErrorLogger
from utils.database import db

error_logger = ErrorLogger("ai_rule_engine")

@dataclass
class RuleApplication:
    """Record of a rule being applied"""
    rule_id: int
    rule_name: str
    rule_type: str
    original_text: str
    modified_text: str
    changes_made: List[Dict[str, str]]
    success: bool
    error: Optional[str] = None

@dataclass
class RuleEngineResult:
    """Complete result of rule engine processing"""
    original_text: str
    processed_text: str
    rules_applied: List[RuleApplication]
    total_replacements: int
    entities_replaced: Dict[str, List[Tuple[str, str]]]
    context_modifications: List[str]
    processing_time: float
    success: bool
    errors: List[str] = field(default_factory=list)

class AIRuleEngine:
    """
    Advanced rule engine for applying programmatic rules to text
    Supports entity replacement, context neutralization, and custom transformations
    """
    
    def __init__(self):
        self.rule_cache: Dict[int, List[Dict]] = {}
        self.entity_cache: Dict[int, List[Dict]] = {}
        self.context_cache: Dict[int, List[Dict]] = {}
        error_logger.log_info("[RuleEngine] Engine initialized")
    
    async def process(
        self, 
        text: str, 
        task_id: int,
        preprocessing_result: Optional[Any] = None
    ) -> RuleEngineResult:
        """
        Main rule processing function
        Applies all rules in priority order
        """
        start_time = datetime.now()
        
        if not text or not text.strip():
            return self._empty_result(text)
        
        original_text = text
        processed_text = text
        rules_applied = []
        total_replacements = 0
        entities_replaced = {}
        context_modifications = []
        errors = []
        
        try:
            entity_rules = await self._get_entity_rules(task_id)
            if entity_rules:
                result = await self._apply_entity_replacements(
                    processed_text, 
                    entity_rules,
                    preprocessing_result
                )
                processed_text = result['text']
                rules_applied.extend(result['applications'])
                total_replacements += result['count']
                entities_replaced = result['entities']
                error_logger.log_info(f"[RuleEngine] Entity replacements: {result['count']}")
            
            context_rules = await self._get_context_rules(task_id)
            if context_rules:
                result = await self._apply_context_rules(
                    processed_text,
                    context_rules,
                    preprocessing_result
                )
                processed_text = result['text']
                rules_applied.extend(result['applications'])
                context_modifications = result['modifications']
                error_logger.log_info(f"[RuleEngine] Context modifications: {len(result['modifications'])}")
            
            ai_rules = await self._get_ai_rules(task_id)
            preprocessing_rules = [r for r in ai_rules if r.get('category') == 'preprocessing']
            if preprocessing_rules:
                result = await self._apply_preprocessing_rules(
                    processed_text,
                    preprocessing_rules
                )
                processed_text = result['text']
                rules_applied.extend(result['applications'])
                total_replacements += result['count']
            
        except Exception as e:
            errors.append(str(e))
            error_logger.log_warning(f"[RuleEngine] Error: {str(e)}")
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return RuleEngineResult(
            original_text=original_text,
            processed_text=processed_text,
            rules_applied=rules_applied,
            total_replacements=total_replacements,
            entities_replaced=entities_replaced,
            context_modifications=context_modifications,
            processing_time=processing_time,
            success=len(errors) == 0,
            errors=errors
        )
    
    async def _get_entity_rules(self, task_id: int) -> List[Dict]:
        """Get entity replacement rules for task"""
        try:
            if task_id in self.entity_cache:
                return self.entity_cache[task_id]
            
            rules = await db.get_entity_replacements(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            self.entity_cache[task_id] = active_rules
            return active_rules
        except Exception as e:
            error_logger.log_warning(f"[RuleEngine] Failed to get entity rules: {str(e)}")
            return []
    
    async def _get_context_rules(self, task_id: int) -> List[Dict]:
        """Get context modification rules for task"""
        try:
            if task_id in self.context_cache:
                return self.context_cache[task_id]
            
            rules = await db.get_context_rules(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            self.context_cache[task_id] = active_rules
            return active_rules
        except Exception as e:
            error_logger.log_warning(f"[RuleEngine] Failed to get context rules: {str(e)}")
            return []
    
    async def _get_ai_rules(self, task_id: int) -> List[Dict]:
        """Get AI rules for task"""
        try:
            if task_id in self.rule_cache:
                return self.rule_cache[task_id]
            
            rules = await db.get_task_rules(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            self.rule_cache[task_id] = active_rules
            return active_rules
        except Exception as e:
            error_logger.log_warning(f"[RuleEngine] Failed to get AI rules: {str(e)}")
            return []
    
    async def _apply_entity_replacements(
        self,
        text: str,
        rules: List[Dict],
        preprocessing_result: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Apply entity replacement rules
        Example: "محمد مصطفى" → "البطل محمد مصطفى"
        """
        processed_text = text
        applications = []
        count = 0
        entities_replaced = {}
        
        for rule in rules:
            try:
                original = rule.get('original_text', '')
                replacement = rule.get('replacement_text', '')
                entity_type = rule.get('entity_type', 'custom')
                case_sensitive = rule.get('case_sensitive', False)
                use_context = rule.get('use_context', True)
                
                if not original or not replacement:
                    continue
                
                if use_context and preprocessing_result:
                    pass
                
                flags = 0 if case_sensitive else re.IGNORECASE
                
                pattern = re.escape(original)
                
                matches = list(re.finditer(pattern, processed_text, flags))
                
                if matches:
                    changes = []
                    for match in matches:
                        changes.append({
                            'original': match.group(),
                            'replacement': replacement,
                            'position': match.start()
                        })
                    
                    processed_text = re.sub(pattern, replacement, processed_text, flags=flags)
                    count += len(matches)
                    
                    if entity_type not in entities_replaced:
                        entities_replaced[entity_type] = []
                    entities_replaced[entity_type].append((original, replacement))
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name=f"Entity: {original}",
                        rule_type='entity_replace',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=changes,
                        success=True
                    ))
                    
                    error_logger.log_info(f"[RuleEngine] Replaced '{original}' with '{replacement}' ({len(matches)} times)")
                    
            except Exception as e:
                applications.append(RuleApplication(
                    rule_id=rule.get('id', 0),
                    rule_name=f"Entity: {rule.get('original_text', 'Unknown')}",
                    rule_type='entity_replace',
                    original_text=text[:100],
                    modified_text=processed_text[:100],
                    changes_made=[],
                    success=False,
                    error=str(e)
                ))
        
        return {
            'text': processed_text,
            'applications': applications,
            'count': count,
            'entities': entities_replaced
        }
    
    async def _apply_context_rules(
        self,
        text: str,
        rules: List[Dict],
        preprocessing_result: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Apply context modification rules
        Example: Neutralize offensive language, adjust tone
        """
        processed_text = text
        applications = []
        modifications = []
        
        neutralization_map = {
            'إرهابي': 'مسلح',
            'إرهابيين': 'مسلحين',
            'عصابة': 'مجموعة',
            'عصابات': 'مجموعات',
            'مجرم': 'متهم',
            'مجرمين': 'متهمين',
            'كلب': 'شخص',
            'حمار': 'شخص',
            'غبي': 'شخص',
            'أحمق': 'شخص'
        }
        
        for rule in rules:
            try:
                rule_type = rule.get('rule_type', '')
                trigger_pattern = rule.get('trigger_pattern', '')
                target_sentiment = rule.get('target_sentiment', 'neutral')
                instructions = rule.get('instructions', '')
                
                if rule_type == 'neutralize_negative':
                    for offensive, neutral in neutralization_map.items():
                        if offensive in processed_text:
                            processed_text = processed_text.replace(offensive, neutral)
                            modifications.append(f"Neutralized: {offensive} → {neutral}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name=rule.get('instructions', 'Neutralize')[:50],
                        rule_type='context_neutralize',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'neutralization', 'count': len(modifications)}],
                        success=True
                    ))
                
                elif rule_type == 'remove_bias':
                    bias_patterns = [
                        (r'المزعوم[ة]?\s*', ''),
                        (r'المدعو[ة]?\s*', ''),
                        (r'الإرهابي[ة]?\s+', ''),
                    ]
                    
                    for pattern, replacement in bias_patterns:
                        if re.search(pattern, processed_text):
                            processed_text = re.sub(pattern, replacement, processed_text)
                            modifications.append(f"Removed bias pattern: {pattern}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name='Remove Bias',
                        rule_type='remove_bias',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'bias_removal'}],
                        success=True
                    ))
                
                elif rule_type == 'enhance_positive':
                    positive_enhancements = [
                        ('انتصار', 'انتصار عظيم'),
                        ('نجاح', 'نجاح باهر'),
                        ('تقدم', 'تقدم ملموس'),
                    ]
                    
                    for original, enhanced in positive_enhancements:
                        if original in processed_text and enhanced not in processed_text:
                            processed_text = processed_text.replace(original, enhanced, 1)
                            modifications.append(f"Enhanced: {original} → {enhanced}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name='Enhance Positive',
                        rule_type='enhance_positive',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'positive_enhancement'}],
                        success=True
                    ))
                
                elif rule_type == 'formal_tone':
                    informal_formal = {
                        'حكى': 'قال',
                        'راح': 'ذهب',
                        'جاب': 'أحضر',
                        'شاف': 'رأى',
                    }
                    
                    for informal, formal in informal_formal.items():
                        if informal in processed_text:
                            processed_text = processed_text.replace(informal, formal)
                            modifications.append(f"Formalized: {informal} → {formal}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name='Formal Tone',
                        rule_type='formal_tone',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'formalization'}],
                        success=True
                    ))
                
                elif rule_type == 'custom' and trigger_pattern:
                    try:
                        if re.search(trigger_pattern, processed_text):
                            modifications.append(f"Custom rule triggered: {trigger_pattern[:30]}")
                            applications.append(RuleApplication(
                                rule_id=rule.get('id', 0),
                                rule_name=f'Custom: {instructions[:30]}',
                                rule_type='custom',
                                original_text=text[:100],
                                modified_text=processed_text[:100],
                                changes_made=[{'type': 'custom_trigger'}],
                                success=True
                            ))
                    except re.error:
                        pass
                        
            except Exception as e:
                applications.append(RuleApplication(
                    rule_id=rule.get('id', 0),
                    rule_name=f"Context: {rule.get('rule_type', 'Unknown')}",
                    rule_type='context_rule',
                    original_text=text[:100],
                    modified_text=processed_text[:100],
                    changes_made=[],
                    success=False,
                    error=str(e)
                ))
        
        return {
            'text': processed_text,
            'applications': applications,
            'modifications': modifications
        }
    
    async def _apply_preprocessing_rules(
        self,
        text: str,
        rules: List[Dict]
    ) -> Dict[str, Any]:
        """Apply preprocessing AI rules"""
        processed_text = text
        applications = []
        count = 0
        
        for rule in rules:
            try:
                rule_type = rule.get('type', '')
                config = rule.get('config', {}) or {}
                
                if rule_type == 'format':
                    remove_extra_spaces = config.get('remove_extra_spaces', True)
                    if remove_extra_spaces:
                        processed_text = re.sub(r'\s+', ' ', processed_text)
                        count += 1
                    
                    remove_urls = config.get('remove_urls', False)
                    if remove_urls:
                        processed_text = re.sub(r'https?://\S+', '', processed_text)
                        count += 1
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name=rule.get('name', 'Format'),
                        rule_type='format',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'formatting'}],
                        success=True
                    ))
                
            except Exception as e:
                applications.append(RuleApplication(
                    rule_id=rule.get('id', 0),
                    rule_name=rule.get('name', 'Unknown'),
                    rule_type=rule.get('type', 'unknown'),
                    original_text=text[:100],
                    modified_text=processed_text[:100],
                    changes_made=[],
                    success=False,
                    error=str(e)
                ))
        
        return {
            'text': processed_text,
            'applications': applications,
            'count': count
        }
    
    def clear_cache(self, task_id: Optional[int] = None):
        """Clear rule caches"""
        if task_id:
            self.rule_cache.pop(task_id, None)
            self.entity_cache.pop(task_id, None)
            self.context_cache.pop(task_id, None)
        else:
            self.rule_cache.clear()
            self.entity_cache.clear()
            self.context_cache.clear()
        error_logger.log_info(f"[RuleEngine] Cache cleared for task_id={task_id}")
    
    def _empty_result(self, text: str) -> RuleEngineResult:
        """Return empty result for empty text"""
        return RuleEngineResult(
            original_text=text or "",
            processed_text=text or "",
            rules_applied=[],
            total_replacements=0,
            entities_replaced={},
            context_modifications=[],
            processing_time=0.0,
            success=True
        )

rule_engine = AIRuleEngine()

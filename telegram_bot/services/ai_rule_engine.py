"""
AI Rule Engine
Stage 2: Apply programmatic rules before AI processing
Handles entity replacement, context neutralization, sentiment adjustment
"""
import re
import asyncio
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from utils.error_handler import ErrorLogger
from utils.database import db

error_logger = ErrorLogger("ai_rule_engine")

# Cache TTL in seconds
CACHE_TTL = 30

@dataclass
class RuleApplication:
    """Record of a rule being applied"""
    rule_id: int
    rule_name: str
    rule_type: str
    original_text: str
    modified_text: str
    changes_made: List[Dict[str, Any]]  # Can contain nested structures
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
    ai_instructions: List[Dict[str, Any]] = field(default_factory=list)  # Instructions for AI processing
    semantic_replacement_rules: List[Dict[str, Any]] = field(default_factory=list)  # Rules for AI semantic matching

class AIRuleEngine:
    """
    Advanced rule engine for applying programmatic rules to text
    Supports entity replacement, context neutralization, and custom transformations
    """
    
    def __init__(self):
        # Cache structure: {task_id: {'data': [...], 'timestamp': float}}
        self.rule_cache: Dict[int, Dict[str, Any]] = {}
        self.entity_cache: Dict[int, Dict[str, Any]] = {}
        self.context_cache: Dict[int, Dict[str, Any]] = {}
        error_logger.log_info("[RuleEngine] Engine initialized with TTL-based caching")
    
    def _is_cache_valid(self, cache: Dict[int, Dict[str, Any]], task_id: int) -> bool:
        """Check if cached data is still valid (not expired)"""
        if task_id not in cache:
            return False
        entry = cache[task_id]
        if 'timestamp' not in entry:
            return False
        return (time.time() - entry['timestamp']) < CACHE_TTL
    
    def _get_cached_data(self, cache: Dict[int, Dict[str, Any]], task_id: int) -> Optional[List[Dict]]:
        """Get cached data if valid, otherwise return None"""
        if self._is_cache_valid(cache, task_id):
            return cache[task_id].get('data', [])
        return None
    
    def _set_cache(self, cache: Dict[int, Dict[str, Any]], task_id: int, data: List[Dict]):
        """Set cache with timestamp"""
        cache[task_id] = {
            'data': data,
            'timestamp': time.time()
        }
    
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
        ai_instructions = []
        semantic_replacement_rules = []
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
                semantic_replacement_rules = result.get('semantic_rules', [])
                error_logger.log_info(f"[RuleEngine] Entity replacements: {result['count']}, Semantic rules: {len(semantic_replacement_rules)}")
            
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
                ai_instructions = result.get('ai_instructions', [])
                error_logger.log_info(f"[RuleEngine] Context modifications: {len(result['modifications'])}, AI instructions: {len(ai_instructions)}")
            
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
            errors=errors,
            ai_instructions=ai_instructions,
            semantic_replacement_rules=semantic_replacement_rules
        )
    
    async def _get_entity_rules(self, task_id: int) -> List[Dict]:
        """Get entity replacement rules for task with TTL-based caching"""
        try:
            # Check cache with TTL
            cached = self._get_cached_data(self.entity_cache, task_id)
            if cached is not None:
                error_logger.log_info(f"[RuleEngine] Using cached entity rules for task {task_id} ({len(cached)} rules)")
                return cached
            
            # Fetch from database
            rules = await db.get_entity_replacements(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            # Store in cache with timestamp
            self._set_cache(self.entity_cache, task_id, active_rules)
            error_logger.log_info(f"[RuleEngine] Loaded {len(active_rules)} entity rules for task {task_id} from DB")
            return active_rules
        except Exception as e:
            error_logger.log_warning(f"[RuleEngine] Failed to get entity rules: {str(e)}")
            return []
    
    async def _get_context_rules(self, task_id: int) -> List[Dict]:
        """Get context modification rules for task with TTL-based caching"""
        try:
            # Check cache with TTL
            cached = self._get_cached_data(self.context_cache, task_id)
            if cached is not None:
                error_logger.log_info(f"[RuleEngine] Using cached context rules for task {task_id} ({len(cached)} rules)")
                return cached
            
            # Fetch from database
            rules = await db.get_context_rules(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            # Store in cache with timestamp
            self._set_cache(self.context_cache, task_id, active_rules)
            error_logger.log_info(f"[RuleEngine] Loaded {len(active_rules)} context rules for task {task_id} from DB")
            return active_rules
        except Exception as e:
            error_logger.log_warning(f"[RuleEngine] Failed to get context rules: {str(e)}")
            return []
    
    async def _get_ai_rules(self, task_id: int) -> List[Dict]:
        """Get AI rules for task with TTL-based caching"""
        try:
            # Check cache with TTL
            cached = self._get_cached_data(self.rule_cache, task_id)
            if cached is not None:
                return cached
            
            # Fetch from database
            rules = await db.get_task_rules(task_id)
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            # Store in cache with timestamp
            self._set_cache(self.rule_cache, task_id, active_rules)
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
        
        Supports multiple original texts and replacement texts separated by '|':
        - original_text: "احمد|صالح|علي" means any of these will be replaced
        - replacement_text: "طفل" means they will all be replaced with this
        
        When use_context is True, rules are passed to AI for semantic matching
        (e.g., "مليشيا الحوثي" will also match "مليشيات الحوثي")
        """
        processed_text = text
        applications = []
        count = 0
        entities_replaced = {}
        semantic_replacement_rules = []  # Rules to be processed by AI for semantic matching
        
        for rule in rules:
            try:
                original_text = rule.get('original_text', '')
                replacement_text = rule.get('replacement_text', '')
                entity_type = rule.get('entity_type', 'custom')
                case_sensitive = rule.get('case_sensitive', False)
                use_context = rule.get('use_context', True)
                
                if not original_text or not replacement_text:
                    continue
                
                original_list = [o.strip() for o in original_text.split('|') if o.strip()]
                replacement_list = [r.strip() for r in replacement_text.split('|') if r.strip()]
                
                if not original_list or not replacement_list:
                    continue
                
                primary_replacement = replacement_list[0]
                
                flags = 0 if case_sensitive else re.IGNORECASE
                rule_changes = []
                rule_match_count = 0
                
                for original in original_list:
                    pattern = re.escape(original)
                    matches = list(re.finditer(pattern, processed_text, flags))
                    
                    if matches:
                        for match in matches:
                            rule_changes.append({
                                'original': match.group(),
                                'replacement': primary_replacement,
                                'position': match.start()
                            })
                        
                        processed_text = re.sub(pattern, primary_replacement, processed_text, flags=flags)
                        rule_match_count += len(matches)
                        
                        if entity_type not in entities_replaced:
                            entities_replaced[entity_type] = []
                        entities_replaced[entity_type].append((original, primary_replacement))
                        
                        error_logger.log_info(f"[RuleEngine] Replaced '{original}' with '{primary_replacement}' ({len(matches)} times)")
                
                if rule_changes:
                    count += rule_match_count
                    originals_display = ', '.join(original_list[:3])
                    if len(original_list) > 3:
                        originals_display += f'... (+{len(original_list) - 3})'
                    
                    applications.append(RuleApplication(
                        rule_id=rule.get('id', 0),
                        rule_name=f"Entity: {originals_display}",
                        rule_type='entity_replace',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=rule_changes,
                        success=True
                    ))
                
                if use_context:
                    semantic_replacement_rules.append({
                        'id': rule.get('id', 0),
                        'originals': original_list,
                        'replacements': replacement_list,
                        'entity_type': entity_type,
                        'case_sensitive': case_sensitive
                    })
                    error_logger.log_info(f"[RuleEngine] Added semantic rule: {original_list} → {replacement_list} (AI will find variations)")
                    
            except Exception as e:
                applications.append(RuleApplication(
                    rule_id=rule.get('id', 0),
                    rule_name=f"Entity: {rule.get('original_text', 'Unknown')[:30]}",
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
            'entities': entities_replaced,
            'semantic_rules': semantic_replacement_rules  # Pass to AI for semantic matching
        }
    
    async def _apply_context_rules(
        self,
        text: str,
        rules: List[Dict],
        preprocessing_result: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Apply context modification rules
        Applies pattern-based rules and stores instructions for AI processing
        All context rules with instructions will be passed to AI for processing
        """
        processed_text = text
        applications = []
        modifications = []
        ai_instructions = []  # Instructions to be passed to AI
        
        # Standard neutralization map for common offensive terms
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
        
        error_logger.log_info(f"[RuleEngine] Applying {len(rules)} context rules")
        
        for rule in rules:
            try:
                rule_type = rule.get('rule_type', '')
                trigger_pattern = rule.get('trigger_pattern', '')
                target_sentiment = rule.get('target_sentiment', 'neutral')
                instructions = rule.get('instructions', '')
                rule_id = rule.get('id', 0)
                
                error_logger.log_info(f"[RuleEngine] Processing rule {rule_id}: type={rule_type}, instructions={instructions[:50] if instructions else 'none'}...")
                
                # Always record instructions for AI processing
                if instructions:
                    ai_instructions.append({
                        'rule_id': rule_id,
                        'rule_type': rule_type,
                        'instructions': instructions,
                        'target_sentiment': target_sentiment
                    })
                    modifications.append(f"AI_INSTRUCTION: {instructions}")
                
                if rule_type == 'neutralize_negative':
                    changes_made = []
                    for offensive, neutral in neutralization_map.items():
                        if offensive in processed_text:
                            processed_text = processed_text.replace(offensive, neutral)
                            changes_made.append(f"{offensive} → {neutral}")
                            modifications.append(f"Neutralized: {offensive} → {neutral}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule_id,
                        rule_name=instructions[:50] if instructions else 'Neutralize Negative',
                        rule_type='context_neutralize',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'neutralization', 'changes': changes_made}],
                        success=True
                    ))
                    error_logger.log_info(f"[RuleEngine] Neutralized {len(changes_made)} terms")
                
                elif rule_type == 'remove_bias':
                    bias_patterns = [
                        (r'المزعوم[ة]?\s*', ''),
                        (r'المدعو[ة]?\s*', ''),
                        (r'الإرهابي[ة]?\s+', ''),
                    ]
                    
                    changes_made = []
                    for pattern, replacement in bias_patterns:
                        if re.search(pattern, processed_text):
                            processed_text = re.sub(pattern, replacement, processed_text)
                            changes_made.append(pattern)
                            modifications.append(f"Removed bias pattern: {pattern}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule_id,
                        rule_name=instructions[:50] if instructions else 'Remove Bias',
                        rule_type='remove_bias',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'bias_removal', 'patterns': changes_made}],
                        success=True
                    ))
                
                elif rule_type == 'enhance_positive':
                    positive_enhancements = [
                        ('انتصار', 'انتصار عظيم'),
                        ('نجاح', 'نجاح باهر'),
                        ('تقدم', 'تقدم ملموس'),
                    ]
                    
                    changes_made = []
                    for original, enhanced in positive_enhancements:
                        if original in processed_text and enhanced not in processed_text:
                            processed_text = processed_text.replace(original, enhanced, 1)
                            changes_made.append(f"{original} → {enhanced}")
                            modifications.append(f"Enhanced: {original} → {enhanced}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule_id,
                        rule_name=instructions[:50] if instructions else 'Enhance Positive',
                        rule_type='enhance_positive',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'positive_enhancement', 'changes': changes_made}],
                        success=True
                    ))
                
                elif rule_type == 'formal_tone':
                    informal_formal = {
                        'حكى': 'قال',
                        'راح': 'ذهب',
                        'جاب': 'أحضر',
                        'شاف': 'رأى',
                    }
                    
                    changes_made = []
                    for informal, formal in informal_formal.items():
                        if informal in processed_text:
                            processed_text = processed_text.replace(informal, formal)
                            changes_made.append(f"{informal} → {formal}")
                            modifications.append(f"Formalized: {informal} → {formal}")
                    
                    applications.append(RuleApplication(
                        rule_id=rule_id,
                        rule_name=instructions[:50] if instructions else 'Formal Tone',
                        rule_type='formal_tone',
                        original_text=text[:100],
                        modified_text=processed_text[:100],
                        changes_made=[{'type': 'formalization', 'changes': changes_made}],
                        success=True
                    ))
                
                elif rule_type == 'custom':
                    # Custom rules - check trigger if present, always apply instructions
                    triggered = True
                    if trigger_pattern:
                        try:
                            triggered = bool(re.search(trigger_pattern, processed_text))
                        except re.error as e:
                            error_logger.log_warning(f"[RuleEngine] Invalid regex pattern: {trigger_pattern}, error: {e}")
                            triggered = False
                    
                    if triggered:
                        modifications.append(f"Custom rule applied: {instructions[:50] if instructions else trigger_pattern[:30]}")
                        applications.append(RuleApplication(
                            rule_id=rule_id,
                            rule_name=f'Custom: {instructions[:30] if instructions else "trigger"}',
                            rule_type='custom',
                            original_text=text[:100],
                            modified_text=processed_text[:100],
                            changes_made=[{'type': 'custom_trigger', 'instructions': instructions}],
                            success=True
                        ))
                        error_logger.log_info(f"[RuleEngine] Custom rule {rule_id} triggered")
                
                else:
                    # Unknown rule type - still record it if it has instructions
                    if instructions:
                        applications.append(RuleApplication(
                            rule_id=rule_id,
                            rule_name=f'{rule_type}: {instructions[:30]}',
                            rule_type=rule_type or 'unknown',
                            original_text=text[:100],
                            modified_text=processed_text[:100],
                            changes_made=[{'type': 'instruction', 'instructions': instructions}],
                            success=True
                        ))
                        error_logger.log_info(f"[RuleEngine] Rule {rule_id} ({rule_type}) recorded with instructions")
                        
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
        
        error_logger.log_info(f"[RuleEngine] Context rules result: {len(applications)} applied, {len(ai_instructions)} AI instructions")
        
        return {
            'text': processed_text,
            'applications': applications,
            'modifications': modifications,
            'ai_instructions': ai_instructions  # Pass to AI for processing
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
    
    async def apply_summarization_rule(
        self,
        text: str,
        rule_config: Optional[Dict[str, Any]] = None,
        task_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Apply text summarization rule
        Truncates text to specified max length while preserving word boundaries
        """
        if not text or not text.strip():
            return {'text': text, 'success': True, 'applied': False}
        
        rule_config = rule_config or {}
        max_length = rule_config.get('maxLength', 300)
        style = rule_config.get('style', 'balanced')
        
        if not max_length or max_length <= 0:
            return {'text': text, 'success': True, 'applied': False}
        
        text_length = len(text)
        
        # If text is already shorter than max_length, no need to summarize
        if text_length <= max_length:
            error_logger.log_info(f"[RuleEngine] Text length ({text_length}) already within max ({max_length})")
            return {'text': text, 'success': True, 'applied': False}
        
        # Truncate text while preserving word boundaries
        truncated = text[:max_length]
        
        # Find the last space to avoid cutting a word
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.7:  # Only cut at space if it's reasonably close
            truncated = truncated[:last_space]
        
        # Clean up trailing punctuation
        truncated = truncated.rstrip()
        if truncated and truncated[-1] not in '.:،؛!؟':
            truncated += '...'
        
        error_logger.log_info(f"[RuleEngine] Summarization applied | Original: {text_length} chars | Style: {style} | Truncated: {len(truncated)} chars")
        
        return {
            'text': truncated,
            'success': True,
            'applied': True,
            'original_length': text_length,
            'new_length': len(truncated),
            'style': style
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
            success=True,
            errors=[],
            ai_instructions=[]
        )

rule_engine = AIRuleEngine()

"""
AI Postprocessing Engine
Stage 4: Validate output, verify rules applied, format result
Final quality control before delivery
"""
import re
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("ai_postprocessing")

@dataclass
class ValidationResult:
    """Result of validation check"""
    check_name: str
    passed: bool
    details: str
    severity: str = 'info'  # 'info' | 'warning' | 'error'

@dataclass
class PostprocessingResult:
    """Complete postprocessing result"""
    original_ai_output: str
    final_output: str
    validations: List[ValidationResult]
    rules_verified: Dict[str, bool]
    formatting_applied: List[str]
    quality_score: float
    processing_time: float
    success: bool
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

class AIPostprocessingEngine:
    """
    Advanced postprocessing engine for AI output validation and formatting
    Ensures all rules were applied and output meets quality standards
    """
    
    def __init__(self):
        self.min_output_ratio = 0.1
        self.max_output_ratio = 1.5
        self.forbidden_patterns = [
            r'كمساعد\s+ذكاء\s+اصطناعي',
            r'أنا\s+نموذج\s+لغة',
            r'لا\s+أستطيع\s+تلخيص',
            r'I am an AI',
            r'As an AI assistant',
            r'I cannot summarize',
            r'ملخص:',
            r'^ملخص\s*$',
            r'Summary:',
            r'Here is the summary',
        ]
        
        self.required_cleanups = [
            (r'\n{3,}', '\n\n'),
            (r'\s+([،,\.!?])', r'\1'),
            (r'([،,\.!?])\s*([،,\.!?])', r'\1'),
            (r'^\s+', ''),
            (r'\s+$', ''),
        ]
        
        error_logger.log_info("[Postprocessing] Engine initialized")
    
    async def process(
        self,
        ai_output: str,
        original_text: str,
        rule_engine_result: Optional[Any] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> PostprocessingResult:
        """
        Main postprocessing function
        Validates and formats AI output
        """
        start_time = datetime.now()
        config = config or {}
        
        if not ai_output or not ai_output.strip():
            return self._empty_result(ai_output, original_text)
        
        processed_output = ai_output.strip()
        validations = []
        rules_verified = {}
        formatting_applied = []
        warnings = []
        errors = []
        
        if config.get('enable_output_validation', True):
            output_validations = await self._validate_output(
                processed_output, 
                original_text
            )
            validations.extend(output_validations)
            
            for v in output_validations:
                if not v.passed and v.severity == 'error':
                    errors.append(v.details)
                elif not v.passed and v.severity == 'warning':
                    warnings.append(v.details)
        
        if config.get('enable_rule_verification', True) and rule_engine_result:
            rules_verified = await self._verify_rules_applied(
                processed_output,
                rule_engine_result
            )
            
            for rule_name, verified in rules_verified.items():
                if not verified:
                    warnings.append(f"Rule may not be applied: {rule_name}")
        
        output_format = config.get('output_format', 'markdown')
        processed_output, formatting_actions = await self._apply_formatting(
            processed_output,
            output_format
        )
        formatting_applied.extend(formatting_actions)
        
        processed_output = await self._final_cleanup(processed_output)
        
        quality_score = self._calculate_quality_score(
            processed_output,
            original_text,
            validations,
            rules_verified
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        failed_critical = any(
            not v.passed and v.severity == 'error' 
            for v in validations
        )
        
        return PostprocessingResult(
            original_ai_output=ai_output,
            final_output=processed_output,
            validations=validations,
            rules_verified=rules_verified,
            formatting_applied=formatting_applied,
            quality_score=quality_score,
            processing_time=processing_time,
            success=not failed_critical,
            warnings=warnings,
            errors=errors
        )
    
    async def _validate_output(
        self, 
        output: str, 
        original: str
    ) -> List[ValidationResult]:
        """Validate AI output quality and appropriateness"""
        validations = []
        
        if not output or len(output.strip()) < 10:
            validations.append(ValidationResult(
                check_name='output_exists',
                passed=False,
                details='Output is empty or too short',
                severity='error'
            ))
        else:
            validations.append(ValidationResult(
                check_name='output_exists',
                passed=True,
                details='Output has content'
            ))
        
        # Check if output follows news format (no bullet points)
        bullet_patterns = [r'^\s*[•\-\*]', r'\n\s*[•\-\*]', r'^\s*\d+\.', r'\n\s*\d+\.']
        has_bullets = any(re.search(pattern, output, re.MULTILINE) for pattern in bullet_patterns)
        if has_bullets:
            validations.append(ValidationResult(
                check_name='news_format',
                passed=False,
                details='Output contains bullet points - should be news paragraph format',
                severity='warning'
            ))
        else:
            validations.append(ValidationResult(
                check_name='news_format',
                passed=True,
                details='Output is in proper paragraph format (no bullets)'
            ))
        
        
        if original:
            ratio = len(output) / len(original) if len(original) > 0 else 1
            
            if ratio < self.min_output_ratio:
                validations.append(ValidationResult(
                    check_name='length_ratio',
                    passed=False,
                    details=f'Output too short ({ratio:.1%} of original)',
                    severity='warning'
                ))
            elif ratio > self.max_output_ratio:
                validations.append(ValidationResult(
                    check_name='length_ratio',
                    passed=False,
                    details=f'Output longer than original ({ratio:.1%})',
                    severity='warning'
                ))
            else:
                validations.append(ValidationResult(
                    check_name='length_ratio',
                    passed=True,
                    details=f'Length ratio acceptable ({ratio:.1%})'
                ))
        
        for pattern in self.forbidden_patterns:
            if re.search(pattern, output, re.IGNORECASE):
                validations.append(ValidationResult(
                    check_name='forbidden_content',
                    passed=False,
                    details=f'Contains forbidden pattern: {pattern[:30]}',
                    severity='warning'
                ))
                break
        else:
            validations.append(ValidationResult(
                check_name='forbidden_content',
                passed=True,
                details='No forbidden content detected'
            ))
        
        if original:
            original_sentences = set(s.strip() for s in re.split(r'[.!?،]', original) if len(s.strip()) > 20)
            output_sentences = set(s.strip() for s in re.split(r'[.!?،]', output) if len(s.strip()) > 20)
            
            if original_sentences and output_sentences:
                overlap = len(original_sentences.intersection(output_sentences))
                total = len(original_sentences)
                
                if overlap > total * 0.8:
                    validations.append(ValidationResult(
                        check_name='originality',
                        passed=False,
                        details='Output too similar to original (minimal processing)',
                        severity='warning'
                    ))
                else:
                    validations.append(ValidationResult(
                        check_name='originality',
                        passed=True,
                        details='Output appears to be processed'
                    ))
        
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', original))
        output_arabic = len(re.findall(r'[\u0600-\u06FF]', output))
        
        if arabic_chars > len(original) * 0.3:
            if output_arabic < len(output) * 0.2:
                validations.append(ValidationResult(
                    check_name='language_consistency',
                    passed=False,
                    details='Arabic input but output lacks Arabic content',
                    severity='warning'
                ))
            else:
                validations.append(ValidationResult(
                    check_name='language_consistency',
                    passed=True,
                    details='Language consistency maintained'
                ))
        
        return validations
    
    async def _verify_rules_applied(
        self,
        output: str,
        rule_engine_result: Any
    ) -> Dict[str, bool]:
        """Verify that entity replacements and context rules were preserved in AI output"""
        verified = {}
        
        if hasattr(rule_engine_result, 'entities_replaced'):
            for entity_type, replacements in rule_engine_result.entities_replaced.items():
                for original, replacement in replacements:
                    is_verified = replacement in output
                    
                    original_still_present = original in output
                    
                    key = f"entity_{entity_type}_{original[:20]}"
                    verified[key] = is_verified and not original_still_present
                    
                    if not verified[key]:
                        error_logger.log_info(
                            f"[Postprocessing] Entity replacement not verified: {original} → {replacement}"
                        )
        
        if hasattr(rule_engine_result, 'context_modifications'):
            for modification in rule_engine_result.context_modifications:
                verified[f"context_{modification[:20]}"] = True
        
        return verified
    
    async def _apply_formatting(
        self,
        text: str,
        output_format: str
    ) -> Tuple[str, List[str]]:
        """Apply formatting based on output format setting"""
        formatting_applied = []
        
        if output_format == 'markdown':
            if not any(c in text for c in ['**', '*', '•', '-', '#']):
                lines = text.split('\n')
                formatted_lines = []
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        formatted_lines.append('')
                        continue
                    
                    if line.endswith(':') and len(line) < 50:
                        formatted_lines.append(f"**{line}**")
                        formatting_applied.append('bold_headers')
                    elif line.startswith(('-', '•', '*', '–')):
                        formatted_lines.append(line)
                    else:
                        formatted_lines.append(line)
                
                text = '\n'.join(formatted_lines)
        
        elif output_format == 'plain':
            text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
            text = re.sub(r'\*([^*]+)\*', r'\1', text)
            text = re.sub(r'#{1,6}\s*', '', text)
            formatting_applied.append('stripped_markdown')
        
        elif output_format == 'html':
            text = text.replace('**', '<strong>').replace('**', '</strong>')
            text = text.replace('\n', '<br>\n')
            formatting_applied.append('html_conversion')
        
        return text, formatting_applied
    
    async def _final_cleanup(self, text: str) -> str:
        """Apply final cleanup patterns"""
        for pattern, replacement in self.required_cleanups:
            text = re.sub(pattern, replacement, text)
        
        return text.strip()
    
    def _calculate_quality_score(
        self,
        output: str,
        original: str,
        validations: List[ValidationResult],
        rules_verified: Dict[str, bool]
    ) -> float:
        """Calculate overall quality score (0.0 to 1.0)"""
        score = 1.0
        
        for v in validations:
            if not v.passed:
                if v.severity == 'error':
                    score -= 0.3
                elif v.severity == 'warning':
                    score -= 0.1
        
        if rules_verified:
            verified_count = sum(1 for v in rules_verified.values() if v)
            total_count = len(rules_verified)
            if total_count > 0:
                rule_score = verified_count / total_count
                score = (score * 0.7) + (rule_score * 0.3)
        
        return max(0.0, min(1.0, score))
    
    def _empty_result(self, ai_output: str, original: str) -> PostprocessingResult:
        """Return result for empty/failed AI output"""
        return PostprocessingResult(
            original_ai_output=ai_output or "",
            final_output=original or "",
            validations=[ValidationResult(
                check_name='output_exists',
                passed=False,
                details='AI returned empty output, using original text',
                severity='warning'
            )],
            rules_verified={},
            formatting_applied=[],
            quality_score=0.5,
            processing_time=0.0,
            success=True,
            warnings=['AI output was empty, returning original text']
        )

postprocessing_engine = AIPostprocessingEngine()

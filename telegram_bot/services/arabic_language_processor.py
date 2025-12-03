"""
Advanced Arabic Language Processor
Specialized for processing, analyzing, and improving Arabic text
with proper grammar, style, and cultural context
"""
import re
from typing import Dict, List, Any, Tuple
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("arabic_processor")

class ArabicLanguageProcessor:
    """Advanced Arabic text processing and improvement"""
    
    def __init__(self):
        self.diacritics = {
            "fatha": "َ",
            "damma": "ُ",
            "kasra": "ِ",
            "sukun": "ْ"
        }
        self.common_mistakes = self._load_common_mistakes()
        self.style_rules = self._load_style_rules()
    
    def _load_common_mistakes(self) -> Dict[str, str]:
        """Load common Arabic grammar mistakes and corrections"""
        return {
            # الأخطاء الشائعة والتصحيحات
            "ال": "ال",  # تثبيت ال التعريف
            "الي": "إلى",
            "الى": "إلى",
            "من": "من",
            "هذا الذي": "الذي",
            "قال قال": "قال",
            "و ": "و",
            "ب ": "ب",
            "ل ": "ل",
            "ك ": "ك",
        }
    
    def _load_style_rules(self) -> Dict[str, Dict[str, str]]:
        """Load style guidelines"""
        return {
            "formal": {
                "is_best": "هو الأفضل",
                "have": "لديه",
                "very": "للغاية",
            },
            "news": {
                "emergency": "طارئ",
                "breaking": "عاجل",
                "developing": "متطور",
            }
        }
    
    def fix_common_mistakes(self, text: str) -> Tuple[str, List[str]]:
        """Fix common Arabic grammar mistakes"""
        fixed_text = text
        corrections = []
        
        # Fix common typos
        replacements = {
            r"إلإ": "إلى",
            r"الي([^ة])": r"إلى\1",
            r"الى": "إلى",
            r"هؤلاء": "هؤلاء",  # تصحيح الهمزة
            r"ئ": "ئ",  # توحيد الهمزة
            r"ء": "ء",  # توحيد الهمزة
        }
        
        for pattern, replacement in replacements.items():
            if re.search(pattern, fixed_text):
                fixed_text = re.sub(pattern, replacement, fixed_text)
                corrections.append(f"تم تصحيح: {pattern} → {replacement}")
        
        return fixed_text, corrections
    
    def normalize_text(self, text: str) -> str:
        """Normalize Arabic text"""
        
        # Remove diacritics if not needed
        text = re.sub(r'[\u064B-\u0655]', '', text)
        
        # Normalize Arabic numbers
        text = text.replace("٠", "0").replace("١", "1").replace("٢", "2")
        text = text.replace("٣", "3").replace("٤", "4").replace("٥", "5")
        text = text.replace("٦", "6").replace("٧", "7").replace("٨", "8")
        text = text.replace("٩", "9")
        
        # Normalize spaces
        text = re.sub(r' +', ' ', text)
        
        # Normalize quotes
        text = text.replace(""", '"').replace(""", '"')
        text = text.replace("'", "'").replace("'", "'")
        
        return text.strip()
    
    def improve_style(self, text: str, target_style: str = "formal") -> str:
        """Improve text style"""
        improved = text
        
        if target_style == "formal":
            improvements = {
                r"عشان": "لأن",
                r"ليه": "لماذا",
                r"إيه": "ماذا",
                r"أنا قول": "أنا أقول",
                r"أكتب لك": "سأخبرك",
            }
            
            for pattern, replacement in improvements.items():
                improved = re.sub(pattern, replacement, improved, flags=re.IGNORECASE)
        
        elif target_style == "news":
            # Make it more news-like
            improved = re.sub(r'قال', 'أفادت المصادر', improved, count=1)
        
        return improved.strip()
    
    def analyze_readability(self, text: str) -> Dict[str, Any]:
        """Analyze text readability"""
        
        sentences = [s.strip() for s in text.split('۔') if s.strip()]
        words = text.split()
        
        avg_sentence_length = len(words) / len(sentences) if sentences else 0
        avg_word_length = sum(len(w) for w in words) / len(words) if words else 0
        
        readability = {
            "total_words": len(words),
            "total_sentences": len(sentences),
            "avg_sentence_length": round(avg_sentence_length, 1),
            "avg_word_length": round(avg_word_length, 1),
            "readability_score": "سهل" if avg_word_length < 6 else "متوسط" if avg_word_length < 8 else "معقد",
            "assessment": []
        }
        
        if avg_sentence_length > 25:
            readability["assessment"].append("⚠️ الجمل طويلة جداً - يفضل تقسيمها")
        
        if avg_word_length < 4:
            readability["assessment"].append("✓ كلمات مناسبة وسهلة")
        
        return readability
    
    def enhance_arabic(self, text: str) -> Tuple[str, Dict[str, Any]]:
        """Comprehensive Arabic enhancement"""
        
        result = {
            "original_length": len(text),
            "normalized": "",
            "improved": "",
            "readability": {},
            "corrections": [],
            "enhancement_score": 0.0
        }
        
        try:
            # 1. Normalize
            normalized, _ = self.fix_common_mistakes(text)
            normalized = self.normalize_text(normalized)
            result["normalized"] = normalized
            
            # 2. Improve style
            improved = self.improve_style(normalized, target_style="formal")
            result["improved"] = improved
            
            # 3. Analyze readability
            result["readability"] = self.analyze_readability(improved)
            
            # Calculate enhancement score
            original_readability = self.analyze_readability(text)
            original_score = {"سهل": 3, "متوسط": 2, "معقد": 1}
            new_score = original_score.get(result["readability"]["readability_score"], 1)
            
            result["enhancement_score"] = min(1.0, new_score / 3.0)
            
            return improved, result
            
        except Exception as e:
            error_logger.log_info(f"Arabic enhancement error: {str(e)}")
            result["error"] = str(e)
            return text, result


# Global instance
arabic_processor = ArabicLanguageProcessor()

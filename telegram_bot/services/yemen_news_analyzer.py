"""
Yemen Political News Expert Analyzer
Specialized system for analyzing Yemen-related political news, interviews, broadcasts
with fact-checking and deep political analysis
"""
import re
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from utils.error_handler import ErrorLogger
from services.ai_providers import ai_manager

error_logger = ErrorLogger("yemen_analyzer")

class YemenPoliticalAnalyzer:
    """Expert analyzer for Yemen political news and developments"""
    
    def __init__(self):
        self.yemen_actors = self._load_yemen_actors()
        self.political_events = self._load_political_events()
        self.keywords = self._load_keywords()
    
    def _load_yemen_actors(self) -> Dict[str, List[str]]:
        """Load Yemen political actors database"""
        return {
            "government": [
                "الحكومة الشرعية", "رئيس الجمهورية", "عبد ربه منصور هادي",
                "الحكومة اليمنية", "المجلس الرئاسي", "الجيش الوطني"
            ],
            "houthi": [
                "الحوثيون", "أنصار الله", "الحركة الحوثية", "جماعة الحوثيين",
                "عبد الملك الحوثي", "محمد علي الحوثي"
            ],
            "southern": [
                "الانتقالي الجنوبي", "المجلس الانتقالي", "التحالف الجنوبي",
                "عيدروس الزبيدي", "لمين القعيطي"
            ],
            "international": [
                "التحالف العربي", "السعودية", "الإمارات", "الجيش السعودي",
                "بقادة التحالف", "التحالف الدولي"
            ],
            "humanitarian": [
                "الأمم المتحدة", "برنامج الغذاء العالمي", "المنظمات الدولية",
                "الصليب الأحمر", "منظمات إنسانية"
            ]
        }
    
    def _load_political_events(self) -> Dict[str, List[str]]:
        """Load key political events and topics"""
        return {
            "conflicts": [
                "معارك", "اشتباكات", "عمليات عسكرية", "قصف", "حصار",
                "تفجيرات", "هجمات", "غارات جوية"
            ],
            "political": [
                "اجتماعات سياسية", "مفاوضات", "حوار وطني", "اتفاقيات",
                "تشكيل حكومة", "جدل سياسي", "بيانات رسمية"
            ],
            "humanitarian": [
                "أزمة إنسانية", "جوع", "نزوح", "لاجئون", "وباء",
                "أمراض", "معاناة إنسانية", "كارثة"
            ],
            "economic": [
                "أزمة اقتصادية", "سعر الصرف", "التضخم", "الواردات",
                "الصادرات", "المرتبات", "الرواتب"
            ]
        }
    
    def _load_keywords(self) -> Dict[str, List[str]]:
        """Load analysis keywords"""
        return {
            "importance_high": ["حرج", "طارئ", "عاجل", "أزمة", "كارثة", "خطير"],
            "importance_medium": ["مهم", "جديد", "تطور", "تحول", "تغيير"],
            "reliability_indicators": ["مصدر موثوق", "يؤكد", "تأكد", "شهود عيان"],
            "conflict_keywords": ["نزاع", "صراع", "توتر", "تصعيد", "تهديد"],
            "peace_keywords": ["سلام", "تسوية", "اتفاق", "حوار", "محادثات"],
        }
    
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract political entities from text"""
        entities = {
            "actors": [],
            "events": [],
            "locations": [],
            "dates": []
        }
        
        # Extract actors - use original text since Arabic has no case distinction
        for category, names in self.yemen_actors.items():
            for name in names:
                if name in text:
                    if name not in entities["actors"]:
                        entities["actors"].append(name)
        
        # Extract events - use original text since Arabic has no case distinction
        for category, keywords in self.political_events.items():
            for keyword in keywords:
                if keyword in text:
                    if keyword not in entities["events"]:
                        entities["events"].append(keyword)
        
        # Extract Yemen locations - use original text
        yemen_locations = ["صنعاء", "عدن", "تعز", "حضرموت", "مأرب", "الحديدة", "إب", "ذمار"]
        for location in yemen_locations:
            if location in text:
                if location not in entities["locations"]:
                    entities["locations"].append(location)
        
        # Extract dates
        dates = re.findall(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', text)
        entities["dates"] = list(set(dates))
        
        return entities
    
    def analyze_sentiment_political(self, text: str) -> Dict[str, Any]:
        """Analyze political sentiment and bias"""
        text_lower = text.lower()
        
        analysis = {
            "sentiment": "neutral",
            "bias_indicators": [],
            "emotional_language": [],
            "confidence": 0.0
        }
        
        # Check for emotional language
        emotional_words = {
            "positive": ["نجاح", "إنجاز", "تقدم", "انتصار", "نصر", "إنقاذ"],
            "negative": ["فشل", "كارثة", "تدهور", "خسارة", "هزيمة", "معاناة"],
            "neutral": ["حدث", "يقول", "أكد", "أعلن"]
        }
        
        positive_count = sum(1 for word in emotional_words["positive"] if word in text_lower)
        negative_count = sum(1 for word in emotional_words["negative"] if word in text_lower)
        
        if positive_count > negative_count:
            analysis["sentiment"] = "positive"
            analysis["confidence"] = min(positive_count / (positive_count + negative_count + 1), 1.0)
        elif negative_count > positive_count:
            analysis["sentiment"] = "negative"
            analysis["confidence"] = min(negative_count / (positive_count + negative_count + 1), 1.0)
        
        return analysis
    
    def identify_importance_level(self, text: str, entities: Dict[str, List[str]]) -> str:
        """Identify news importance level"""
        text_lower = text.lower()
        
        # High importance indicators
        high_indicators = sum(1 for kw in self.keywords["importance_high"] if kw in text_lower)
        
        # Actor count (more actors = more important)
        actor_count = len(entities["actors"])
        
        # Event type importance
        has_conflict = any(kw in text_lower for kw in self.keywords["conflict_keywords"])
        has_peace = any(kw in text_lower for kw in self.keywords["peace_keywords"])
        
        if high_indicators >= 2 or (actor_count >= 3 and has_conflict):
            return "CRITICAL"
        elif high_indicators >= 1 or actor_count >= 2 or has_conflict:
            return "HIGH"
        elif has_peace or actor_count >= 1:
            return "MEDIUM"
        else:
            return "LOW"
    
    async def analyze_news(
        self,
        text: str,
        source_type: str = "news",  # news, interview, broadcast, statement
        provider: str = "groq",
        model: str = "mixtral-8x7b-32768"
    ) -> Dict[str, Any]:
        """
        Comprehensive political analysis of Yemen-related news
        
        Args:
            text: News content
            source_type: Type of source
            provider: AI provider
            model: AI model
        
        Returns:
            Analysis results with all components
        """
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "source_type": source_type,
            "entities": {},
            "sentiment": {},
            "importance": "",
            "summary": "",
            "analysis": "",
            "recommendations": [],
            "fact_check_needed": False
        }
        
        try:
            # 1. Extract entities
            analysis["entities"] = self.extract_entities(text)
            error_logger.log_info(f"[Yemen Analyzer] Extracted entities: {analysis['entities']}")
            
            # 2. Analyze sentiment
            analysis["sentiment"] = self.analyze_sentiment_political(text)
            
            # 3. Identify importance
            analysis["importance"] = self.identify_importance_level(text, analysis["entities"])
            
            # 4. Generate Yemen-expert summary with proper error handling
            summary_prompt = self._build_summary_prompt(text, analysis, source_type)
            try:
                summary = await ai_manager.generate(
                    provider=provider,
                    model=model,
                    prompt=summary_prompt,
                    max_tokens=400,
                    temperature=0.5
                )
                if summary is not None and isinstance(summary, str) and summary.strip():
                    analysis["summary"] = summary.strip()
                else:
                    analysis["summary"] = ""
                    error_logger.log_info("[Yemen Analyzer] ⚠️ AI returned empty summary")
            except Exception as ai_error:
                error_logger.log_info(f"[Yemen Analyzer] ⚠️ AI summary generation failed: {str(ai_error)}")
                analysis["summary"] = ""
                analysis["ai_errors"] = analysis.get("ai_errors", []) + [f"Summary generation failed: {str(ai_error)}"]
            
            # 5. Generate detailed political analysis with proper error handling
            analysis_prompt = self._build_analysis_prompt(text, analysis, source_type)
            try:
                detailed_analysis = await ai_manager.generate(
                    provider=provider,
                    model=model,
                    prompt=analysis_prompt,
                    max_tokens=600,
                    temperature=0.7
                )
                if detailed_analysis is not None and isinstance(detailed_analysis, str) and detailed_analysis.strip():
                    analysis["analysis"] = detailed_analysis.strip()
                else:
                    analysis["analysis"] = ""
                    error_logger.log_info("[Yemen Analyzer] ⚠️ AI returned empty analysis")
            except Exception as ai_error:
                error_logger.log_info(f"[Yemen Analyzer] ⚠️ AI analysis generation failed: {str(ai_error)}")
                analysis["analysis"] = ""
                analysis["ai_errors"] = analysis.get("ai_errors", []) + [f"Analysis generation failed: {str(ai_error)}"]
            
            # 6. Determine if fact-check needed
            analysis["fact_check_needed"] = self._should_fact_check(text, analysis)
            
            # 7. Generate recommendations
            analysis["recommendations"] = self._generate_recommendations(analysis)
            
            # Log success or partial success
            if analysis.get("ai_errors"):
                error_logger.log_info(f"[Yemen Analyzer] ⚠️ Partial analysis complete with AI errors | Importance: {analysis['importance']}")
            else:
                error_logger.log_info(f"[Yemen Analyzer] ✅ Analysis complete | Importance: {analysis['importance']} | Entities: {len(analysis['entities']['actors'])} actors")
            
            return analysis
            
        except Exception as e:
            error_logger.log_info(f"[Yemen Analyzer] ❌ Analysis error: {str(e)}")
            analysis["error"] = str(e)
            return analysis
    
    def _build_summary_prompt(self, text: str, analysis: Dict[str, Any], source_type: str) -> str:
        """Build specialized summary prompt for Yemen news"""
        
        prompt = f"""أنت خبير في الشأن السياسي اليمني. قم بتلخيص النص التالي بتركيز على:
        
1. **الحقائق الأساسية**: من، ماذا، أين، متى
2. **الأطراف المعنية**: {', '.join(analysis['entities']['actors'][:3]) if analysis['entities']['actors'] else 'الأطراف ذات الصلة'}
3. **التطورات الجديدة**: ما الجديد في هذا الخبر
4. **التأثيرات المتوقعة**: على الوضع السياسي والإنساني

اكتب ملخصاً مركزاً (200-300 كلمة) بلغة عربية قوية وواضحة.

النص:
{text[:2000]}"""
        
        return prompt
    
    def _build_analysis_prompt(self, text: str, analysis: Dict[str, Any], source_type: str) -> str:
        """Build detailed analysis prompt"""
        
        prompt = f"""أنت محلل سياسي متخصص في الشأن اليمني. قم بتحليل معمق للنص التالي:

**السياق السياسي الحالي:**
- الأطراف الرئيسية: {', '.join(analysis['entities']['actors'][:5])}
- المواقع المذكورة: {', '.join(analysis['entities']['locations']) if analysis['entities']['locations'] else 'لم'}
- مستوى الأهمية: {analysis['importance']}

**المطلوب:**
1. **التحليل السياسي**: ما دلالة هذا الخبر؟
2. **الأطراف المستفيدة والخاسرة**: من الرابح ومن الخاسر؟
3. **السيناريوهات المحتملة**: ما التطورات المتوقعة؟
4. **الأبعاد الإنسانية**: ما تأثيره على الشعب اليمني؟
5. **الموقف الدولي**: كيف قد ترد الأطراف الدولية؟

الملاحظات:
- استخدم لغة عربية فصحى وقوية
- كن دقيقاً وموضوعياً
- تجنب المبالغة أو التحيز

النص:
{text[:2000]}"""
        
        return prompt
    
    def _should_fact_check(self, text: str, analysis: Dict[str, Any]) -> bool:
        """Determine if fact-checking is needed"""
        
        # High priority for fact-checking
        fact_check_triggers = [
            analysis["importance"] in ["CRITICAL", "HIGH"],
            "حسب" in text or "زعم" in text or "قال" in text,
            analysis["sentiment"]["confidence"] > 0.8,
            any(keyword in text.lower() for keyword in ["تقرير", "إحصائية", "أرقام"])
        ]
        
        return sum(fact_check_triggers) >= 2
    
    def _generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for action or further investigation"""
        
        recommendations = []
        
        if analysis["importance"] == "CRITICAL":
            recommendations.append("⚠️ متابعة مستمرة مطلوبة - هذا تطور حرج")
        
        if analysis["fact_check_needed"]:
            recommendations.append("✓ يجب التحقق من الحقائق من مصادر موثوقة")
        
        if analysis["sentiment"]["confidence"] > 0.7:
            recommendations.append(f"📊 تحيز قد يكون موجوداً - احذر من الانجرار")
        
        if analysis["entities"]["actors"] and len(analysis["entities"]["actors"]) > 3:
            recommendations.append("🔗 تابع تفاعلات جميع الأطراف المعنية")
        
        return recommendations


# Global instance
yemen_analyzer = YemenPoliticalAnalyzer()

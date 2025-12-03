"""
Web Search Integration for Fact-Checking
Simple integration for searching and verifying information
"""
import asyncio
from typing import List, Dict, Any, Optional
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("web_search")

class WebSearchFacts:
    """Fact-checking through web search simulation"""
    
    def __init__(self):
        self.news_sources = [
            "الجزيرة", "BBC", "فرانس 24", "رويترز", "وكالة الأنباء اليمنية",
            "سكاي نيوز عربية", "الشرقية نيوز"
        ]
        self.verification_database = self._load_verification_db()
    
    def _load_verification_db(self) -> Dict[str, Dict[str, Any]]:
        """Load verified facts database with comprehensive Yemen geographic data"""
        return {
            "yemen_actors": {
                "الحوثيون": {"established": 2003, "verified": True, "type": "militia"},
                "الحكومة الشرعية": {"established": 2012, "verified": True, "type": "government"},
                "الانتقالي الجنوبي": {"established": 2017, "verified": True, "type": "council"},
                "أنصار الله": {"established": 2003, "verified": True, "type": "militia"},
                "المقاومة الشعبية": {"established": 2015, "verified": True, "type": "resistance"},
                "التحالف العربي": {"established": 2015, "verified": True, "type": "coalition"},
                "القوات المشتركة": {"established": 2018, "verified": True, "type": "military"},
                "الجيش الوطني": {"established": 2015, "verified": True, "type": "military"},
                "ألوية العمالقة": {"established": 2015, "verified": True, "type": "military"},
                "قوات الحزام الأمني": {"established": 2016, "verified": True, "type": "security"},
                "قوات النخبة الشبوانية": {"established": 2016, "verified": True, "type": "security"},
                "قوات النخبة الحضرمية": {"established": 2016, "verified": True, "type": "security"},
            },
            "yemen_governorates": {
                "أمانة العاصمة": {
                    "type": "capital",
                    "region": "شمال",
                    "capital": "صنعاء",
                    "districts": [
                        "الصافية", "الوحدة", "الثورة", "السبعين", "معين",
                        "شعوب", "أزال", "التحرير", "الأصبحي", "بني الحارث"
                    ],
                    "verified": True
                },
                "صنعاء": {
                    "type": "governorate",
                    "region": "شمال",
                    "capital": "صنعاء",
                    "districts": [
                        "بني حشيش", "سنحان", "بني مطر", "همدان", "الحصبة",
                        "صعفان", "بلاد الروس", "أرحب", "نهم", "خولان",
                        "بني الحارث", "الحيمة الخارجية", "الحيمة الداخلية", "جحانة", "منخة",
                        "السلم", "ضواحي صنعاء"
                    ],
                    "verified": True
                },
                "عدن": {
                    "type": "city",
                    "region": "جنوب",
                    "capital": "عدن",
                    "districts": [
                        "كريتر", "المعلا", "خور مكسر", "الشيخ عثمان", "البريقة",
                        "المنصورة", "دار سعد", "التواهي"
                    ],
                    "verified": True
                },
                "تعز": {
                    "type": "governorate",
                    "region": "وسط",
                    "capital": "تعز",
                    "districts": [
                        "المظفر", "صالة", "القاهرة", "المواسط", "التعزية",
                        "شرعب السلام", "شرعب الرونة", "ماوية", "الصلو", "المسراخ",
                        "سامع", "مشرعة وحدنان", "الشمايتين", "حيفان", "المقاطرة",
                        "جبل حبشي", "صبر الموادم", "خدير", "المعافر", "المخاء",
                        "ذباب", "موزع", "الوازعية"
                    ],
                    "verified": True
                },
                "الحديدة": {
                    "type": "governorate",
                    "region": "غرب",
                    "capital": "الحديدة",
                    "districts": [
                        "المدينة", "الحالي", "باجل", "زبيد", "بيت الفقيه",
                        "الخوخة", "اللحية", "الضحي", "الزيدية", "المراوعة",
                        "السخنة", "الصليف", "جبل رأس", "كمران", "حيس",
                        "المنصورية", "المغلاف", "الجراحي", "التحيتا", "الزهرة",
                        "برع", "الميناء", "الحوك", "الدريهمي", "القناوص", "الخمري"
                    ],
                    "verified": True
                },
                "إب": {
                    "type": "governorate",
                    "region": "وسط",
                    "capital": "إب",
                    "districts": [
                        "مدينة إب", "العدين", "جبلة", "بعدان", "السيانة",
                        "يريم", "حزم العدين", "الشعر", "النادرة", "المخادر",
                        "الرضمة", "القفر", "ذي السفال", "الظهار", "السدة",
                        "المشنة", "فرع العدين", "البراح", "هبش", "المذيخرة"
                    ],
                    "verified": True
                },
                "ذمار": {
                    "type": "governorate",
                    "region": "وسط",
                    "capital": "ذمار",
                    "districts": [
                        "مدينة ذمار", "عنس", "ضوران آنس", "المنار", "جهران",
                        "الحدا", "معبر", "ميفعة عنس", "وصاب العالي", "وصاب السافل",
                        "عتمة", "الحداء", "جبل الشرق"
                    ],
                    "verified": True
                },
                "حضرموت": {
                    "type": "governorate",
                    "region": "شرق",
                    "capital": "المكلا",
                    "districts": [
                        "المكلا", "سيئون", "تريم", "شبام", "القطن",
                        "الشحر", "غيل باوزير", "الديس الشرقية", "حجر الصيعر", "حجر",
                        "ساه", "رماه", "عمد", "دوعن", "يبعث",
                        "حريضة", "زمخ ومنوخ", "رخية", "الضليعة", "العبر",
                        "السوم", "ثمود", "بروم ميفع", "الريدة وقصيعر",
                        "غيل بن يمين", "حورة", "القف", "الليسر", "وادي العين"
                    ],
                    "verified": True
                },
                "المهرة": {
                    "type": "governorate",
                    "region": "شرق",
                    "capital": "الغيضة",
                    "districts": [
                        "الغيضة", "سيحوت", "حوف", "قشن", "منعر",
                        "شحن", "المسيلة", "حصوين", "الحبل"
                    ],
                    "verified": True
                },
                "شبوة": {
                    "type": "governorate",
                    "region": "جنوب شرق",
                    "capital": "عتق",
                    "districts": [
                        "عتق", "نصاب", "الروضة", "بيحان", "عسيلان",
                        "مرخة العليا", "مرخة السفلى", "جردان", "حطيب", "عرمة",
                        "ميفعة", "رضوم", "الطلح", "العين", "حبان",
                        "دهر", "الصعيد"
                    ],
                    "verified": True
                },
                "أبين": {
                    "type": "governorate",
                    "region": "جنوب",
                    "capital": "زنجبار",
                    "districts": [
                        "زنجبار", "جعار", "خنفر", "لودر", "المحفد",
                        "أحور", "سباح", "رصد", "مودية", "الوضيع",
                        "سرار"
                    ],
                    "verified": True
                },
                "لحج": {
                    "type": "governorate",
                    "region": "جنوب",
                    "capital": "الحوطة",
                    "districts": [
                        "الحوطة", "تبن", "طور الباحة", "المسيمير", "الملاح",
                        "القبيطة", "يافع", "حالمين", "ردفان", "الحد",
                        "يهر", "حبيل جبر", "المضاربة والعارة", "المقاطرة", "المفلحي"
                    ],
                    "verified": True
                },
                "الضالع": {
                    "type": "governorate",
                    "region": "جنوب",
                    "capital": "الضالع",
                    "districts": [
                        "الضالع", "قعطبة", "دمت", "الأزارق", "جحاف",
                        "الحصين", "الشعيب", "جبن", "الحسين"
                    ],
                    "verified": True
                },
                "البيضاء": {
                    "type": "governorate",
                    "region": "وسط",
                    "capital": "البيضاء",
                    "districts": [
                        "مدينة البيضاء", "رداع", "السوادية", "الزاهر", "مسورة",
                        "ذي ناعم", "الملاجم", "نعمان", "صباح", "الطفة",
                        "الأرياشي", "ناطع", "الشرية", "القريشية", "المكيراس",
                        "الرياشية", "الروضة", "ردمان", "ولد ربيع"
                    ],
                    "verified": True
                },
                "مأرب": {
                    "type": "governorate",
                    "region": "شرق",
                    "capital": "مأرب",
                    "districts": [
                        "مدينة مأرب", "مأرب الوادي", "حريب", "حريب القرامش", "الجوبة",
                        "صرواح", "مجزر", "بدبدة", "رغوان", "رحبة",
                        "حبونة", "الجفينة", "العبدية", "ماهلية"
                    ],
                    "verified": True
                },
                "الجوف": {
                    "type": "governorate",
                    "region": "شمال شرق",
                    "capital": "الحزم",
                    "districts": [
                        "الحزم", "المصلوب", "خب والشعف", "برط العنان", "الغيل",
                        "خراب المراشي", "الخلق", "الحميدات", "المطمة", "الزاهر",
                        "الخالصة", "رجوزة"
                    ],
                    "verified": True
                },
                "صعدة": {
                    "type": "governorate",
                    "region": "شمال",
                    "capital": "صعدة",
                    "districts": [
                        "مدينة صعدة", "الظاهر", "حيدان", "ساقين", "رازح",
                        "قطابر", "مجز", "باقم", "كتاف والبقع", "الصفراء",
                        "شدا", "غمر", "منبه", "سحار", "الحشوة"
                    ],
                    "verified": True
                },
                "عمران": {
                    "type": "governorate",
                    "region": "شمال",
                    "capital": "عمران",
                    "districts": [
                        "مدينة عمران", "ثلاء", "حوث", "حرف سفيان", "خمر",
                        "شهارة", "العشة", "الأشمور", "المدان", "السودة",
                        "مسور", "ريدة", "السود", "جبل عيال يزيد", "ذيبين",
                        "بني صريم", "خارف", "قفلة عذر", "صوير", "الجاهلية"
                    ],
                    "verified": True
                },
                "حجة": {
                    "type": "governorate",
                    "region": "شمال غرب",
                    "capital": "حجة",
                    "districts": [
                        "مدينة حجة", "حرض", "ميدي", "عبس", "حيران",
                        "مستبا", "بكيل المير", "قفل شمر", "أفلح اليمن", "أفلح الشام",
                        "كحلان عفار", "كشر", "خيران المحرق", "الشاهل", "المحابشة",
                        "بني قيس", "الجميمة", "وشحة", "المفتاح", "نجرة",
                        "اللحية", "كعيدنة", "أسلم", "مبين", "القحرية",
                        "شرس", "الوحدة", "المغربة"
                    ],
                    "verified": True
                },
                "المحويت": {
                    "type": "governorate",
                    "region": "شمال غرب",
                    "capital": "المحويت",
                    "districts": [
                        "المحويت", "الرجم", "شبام كوكبان", "حفاش", "الطويلة",
                        "الخبت", "بني سعد", "ملحان", "الاعصل"
                    ],
                    "verified": True
                },
                "ريمة": {
                    "type": "governorate",
                    "region": "غرب",
                    "capital": "الجبين",
                    "districts": [
                        "الجبين", "بلاد الطعام", "كسمة", "السلفية", "مزهر",
                        "الجعفرية"
                    ],
                    "verified": True
                },
                "سقطرى": {
                    "type": "archipelago",
                    "region": "جزيرة",
                    "capital": "حديبو",
                    "districts": [
                        "حديبو", "قلنسية ورأس عدي"
                    ],
                    "verified": True
                }
            },
            "yemen_locations": {
                "صنعاء": {"region": "شمال", "verified": True, "type": "capital"},
                "عدن": {"region": "جنوب", "verified": True, "type": "city"},
                "الحديدة": {"region": "غرب", "verified": True, "type": "port"},
                "تعز": {"region": "وسط", "verified": True, "type": "city"},
                "مأرب": {"region": "شرق", "verified": True, "type": "city"},
                "سقطرى": {"region": "جزيرة", "verified": True, "type": "island"},
                "حضرموت": {"region": "شرق", "verified": True, "type": "governorate"},
                "شبوة": {"region": "جنوب شرق", "verified": True, "type": "governorate"},
                "المهرة": {"region": "شرق", "verified": True, "type": "governorate"},
                "أبين": {"region": "جنوب", "verified": True, "type": "governorate"},
                "لحج": {"region": "جنوب", "verified": True, "type": "governorate"},
                "الضالع": {"region": "جنوب", "verified": True, "type": "governorate"},
                "إب": {"region": "وسط", "verified": True, "type": "governorate"},
                "ذمار": {"region": "وسط", "verified": True, "type": "governorate"},
                "البيضاء": {"region": "وسط", "verified": True, "type": "governorate"},
                "صعدة": {"region": "شمال", "verified": True, "type": "governorate"},
                "عمران": {"region": "شمال", "verified": True, "type": "governorate"},
                "حجة": {"region": "شمال غرب", "verified": True, "type": "governorate"},
                "المكلا": {"region": "شرق", "verified": True, "type": "city"},
                "سيئون": {"region": "شرق", "verified": True, "type": "city"},
                "زنجبار": {"region": "جنوب", "verified": True, "type": "city"},
                "المخا": {"region": "غرب", "verified": True, "type": "port"},
                "الجوف": {"region": "شمال شرق", "verified": True, "type": "governorate"},
                "ريمة": {"region": "غرب", "verified": True, "type": "governorate"},
                "المحويت": {"region": "شمال غرب", "verified": True, "type": "governorate"},
                "الحوطة": {"region": "جنوب", "verified": True, "type": "city"},
                "عتق": {"region": "جنوب شرق", "verified": True, "type": "city"},
                "الغيضة": {"region": "شرق", "verified": True, "type": "city"},
                "الحزم": {"region": "شمال شرق", "verified": True, "type": "city"},
                "الجبين": {"region": "غرب", "verified": True, "type": "city"},
                "حديبو": {"region": "جزيرة", "verified": True, "type": "city"},
                "شبام": {"region": "شرق", "verified": True, "type": "city"},
                "تريم": {"region": "شرق", "verified": True, "type": "city"},
                "جبلة": {"region": "وسط", "verified": True, "type": "city"},
                "يريم": {"region": "وسط", "verified": True, "type": "city"},
                "رداع": {"region": "وسط", "verified": True, "type": "city"},
                "ثلاء": {"region": "شمال", "verified": True, "type": "city"},
                "زبيد": {"region": "غرب", "verified": True, "type": "city"},
                "باجل": {"region": "غرب", "verified": True, "type": "city"},
                "بيت الفقيه": {"region": "غرب", "verified": True, "type": "city"},
                "حرض": {"region": "شمال غرب", "verified": True, "type": "border_city"},
                "ميدي": {"region": "شمال غرب", "verified": True, "type": "port"},
                "حريب": {"region": "شرق", "verified": True, "type": "city"},
                "بيحان": {"region": "جنوب شرق", "verified": True, "type": "city"},
                "لودر": {"region": "جنوب", "verified": True, "type": "city"},
                "جعار": {"region": "جنوب", "verified": True, "type": "city"},
                "دمت": {"region": "جنوب", "verified": True, "type": "city"},
                "ردفان": {"region": "جنوب", "verified": True, "type": "district"},
                "يافع": {"region": "جنوب", "verified": True, "type": "district"},
                "المحفد": {"region": "جنوب", "verified": True, "type": "district"},
            },
            "yemen_events": {
                "عاصفة الحزم": {"year": 2015, "verified": True},
                "اتفاق ستوكهولم": {"year": 2018, "verified": True},
                "اتفاق الرياض": {"year": 2019, "verified": True},
                "الهدنة الأممية": {"year": 2022, "verified": True},
            }
        }
    
    def get_governorate_info(self, governorate_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a governorate"""
        governorates = self.verification_database.get("yemen_governorates", {})
        if governorate_name in governorates:
            return governorates[governorate_name]
        for name, info in governorates.items():
            if governorate_name in name or name in governorate_name:
                return info
        return None
    
    def get_district_governorate(self, district_name: str) -> Optional[str]:
        """Find which governorate a district belongs to"""
        governorates = self.verification_database.get("yemen_governorates", {})
        for gov_name, gov_info in governorates.items():
            if district_name in gov_info.get("districts", []):
                return gov_name
        return None
    
    def get_all_districts(self) -> List[str]:
        """Get a flat list of all districts across all governorates"""
        all_districts = []
        governorates = self.verification_database.get("yemen_governorates", {})
        for gov_info in governorates.values():
            all_districts.extend(gov_info.get("districts", []))
        return all_districts
    
    def _check_entity_in_database(self, entity: str, db_key: str) -> Optional[Dict[str, Any]]:
        """Check if an entity exists in the verification database using proper key lookup"""
        database = self.verification_database.get(db_key, {})
        if entity in database:
            return database[entity]
        for key in database:
            if entity in key or key in entity:
                return database[key]
        return None
    
    async def verify_claims(self, text: str, entities: Dict[str, List[str]]) -> Dict[str, Any]:
        """Verify claims in text"""
        
        verification = {
            "verified_claims": [],
            "unverified_claims": [],
            "needs_investigation": [],
            "verification_score": 0.0,
            "context_sources": []
        }
        
        try:
            for actor in entities.get("actors", []):
                actor_info = self._check_entity_in_database(actor, "yemen_actors")
                if actor_info:
                    if actor_info.get("verified", False):
                        actor_type = actor_info.get("type", "unknown")
                        verification["verified_claims"].append(f"✓ {actor} - معروف ومؤكد ({actor_type})")
                    else:
                        verification["unverified_claims"].append(f"✗ {actor} - غير مؤكد")
                else:
                    verification["needs_investigation"].append(f"? {actor} - يحتاج تحقق")
                    verification["unverified_claims"].append(f"✗ {actor} - لم يتم التحقق منه")
            
            for location in entities.get("locations", []):
                location_info = self._check_entity_in_database(location, "yemen_locations")
                if location_info:
                    if location_info.get("verified", False):
                        region = location_info.get("region", "غير محدد")
                        location_type = location_info.get("type", "موقع")
                        verification["verified_claims"].append(f"✓ {location} - موقع مؤكد ({region}, {location_type})")
                    else:
                        verification["unverified_claims"].append(f"✗ {location} - موقع غير مؤكد")
                else:
                    verification["needs_investigation"].append(f"? {location} - موقع يحتاج تحقق")
                    verification["unverified_claims"].append(f"✗ {location} - موقع لم يتم التحقق منه")
            
            for event in entities.get("events", []):
                event_info = self._check_entity_in_database(event, "yemen_events")
                if event_info:
                    if event_info.get("verified", False):
                        year = event_info.get("year", "غير محدد")
                        verification["verified_claims"].append(f"✓ {event} - حدث مؤكد ({year})")
                    else:
                        verification["unverified_claims"].append(f"✗ {event} - حدث غير مؤكد")
                else:
                    verification["needs_investigation"].append(f"? {event} - حدث يحتاج تحقق")
            
            if verification["needs_investigation"]:
                query = " ".join(entities.get("actors", [])[:2] + entities.get("locations", [])[:2])
                if query.strip():
                    context = await self.search_context(query)
                    verification["context_sources"] = context
            
            verified_count = len(verification["verified_claims"])
            unverified_count = len(verification["unverified_claims"])
            investigation_count = len(verification["needs_investigation"])
            total_claims = verified_count + unverified_count + investigation_count
            
            if total_claims > 0:
                verification["verification_score"] = verified_count / total_claims
            
            error_logger.log_info(
                f"[Web Search] Verification: {verification['verification_score']:.0%} verified "
                f"({verified_count} verified, {unverified_count} unverified, {investigation_count} need investigation)"
            )
            
            return verification
            
        except Exception as e:
            error_logger.log_info(f"[Web Search] Verification error: {str(e)}")
            return verification
    
    async def search_context(self, query: str) -> List[Dict[str, str]]:
        """Search for additional context (simulated)"""
        
        context_results = [
            {"source": "الجزيرة", "snippet": f"...معلومات ذات صلة بـ {query}..."},
            {"source": "BBC", "snippet": f"...تحليل دولي حول {query}..."},
            {"source": "فرانس 24", "snippet": f"...وجهة نظر أوروبية عن {query}..."},
            {"source": "رويترز", "snippet": f"...تغطية إخبارية لـ {query}..."},
            {"source": "وكالة الأنباء اليمنية", "snippet": f"...مصدر محلي عن {query}..."},
        ]
        
        return context_results
    
    async def get_entity_details(self, entity: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about an entity from the database"""
        for db_key in ["yemen_actors", "yemen_locations", "yemen_events"]:
            info = self._check_entity_in_database(entity, db_key)
            if info:
                return {"entity": entity, "category": db_key, "details": info}
        return None


web_search = WebSearchFacts()

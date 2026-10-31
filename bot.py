import os
import requests
from bs4 import BeautifulSoup
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = object
from datetime import datetime, timedelta
import re
import unicodedata

# جلب المفاتيح السرية من إعدادات GitHub
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY) if URL and KEY and create_client else None

GOVERNMENT_KEYWORDS = (
    "وزارة", "وزاره", "الوزارات", "مديرية", "مديريه", "المديريات",
    "هيئة", "هيئه", "الهيئات", "مجلس الوزراء", "مجلس المحافظة",
    "الحكومة", "حكومة", "حكومي", "حكومية", "القطاع العام", "قطاع عام",
    "جهة حكومية", "جهة عامة", "الجمهورية العربية السورية", "رئاسة الجمهورية",
    "رئاسة مجلس الوزراء", "مؤسسة عامة", "المؤسسات العامة"
)
GOVERNMENT_ENTITY_KEYWORDS = (
    "وزارة", "الوزارات", "مديرية", "المديريات", "هيئة", "الهيئات",
    "مجلس الوزراء", "مجلس المحافظة", "الحكومة", "حكومة",
    "القطاع العام", "قطاع عام", "جهة حكومية", "جهة عامة",
    "الجمهورية العربية السورية", "رئاسة الجمهورية", "رئاسة مجلس الوزراء",
    "مؤسسة عامة", "المؤسسات العامة"
)


def normalize_arabic(value):
    text = unicodedata.normalize("NFKC", value or "")
    text = text.replace("ـ", "")
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"}))
    return re.sub(r"\s+", " ", text).strip().casefold()


def classify_job_type(text):
    normalized = normalize_arabic(text)
    # Do not infer public-sector employment from an explicit negative statement alone.
    if any(term in normalized for term in ("غير حكومي", "غير حكوميه", "لا يتبع الحكومة", "لا تتبع الحكومة")):
        if not any(normalize_arabic(keyword) in normalized for keyword in GOVERNMENT_ENTITY_KEYWORDS):
            return "خاص"
    if any(normalize_arabic(keyword) in normalized for keyword in GOVERNMENT_KEYWORDS):
        return "حكومي"
    return "خاص"

def delete_old_samples():
    print("جاري حذف الإعلانات التجريبية...")
    try:
        supabase.table("job_submissions").delete().ilike("description", "%تجريبي%").execute()
        print("تم حذف الإعلانات التجريبية.")
    except Exception as e:
        print(f"خطأ في الحذف: {e}")

def fetch_telegram_jobs():
    print("جاري الاتصال بقناة وظفني...")
    channel_url = "https://t.me/s/wazafne175"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        response = requests.get(channel_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # البحث عن جميع الرسائل النصية
        messages = soup.find_all('div', class_='tgme_widget_message_text')
        jobs = []
        
        
        for msg in messages[-5:]: # آخر 5 رسائل
            text = msg.get_text(separator='\n').strip()
            if len(text) < 20: continue # تجاهل الرسائل القصيرة

            title = text.split('\n')[0][:100] # أول سطر كعنوان
            
            # تصنيف الجهة بعد تطبيع الكتابة العربية؛ الخاص هو الافتراضي فقط عند غياب قرائن القطاع العام.
            job_type = classify_job_type(text)
            
            job = {
                "title": title,
                "company": "من قناة وظفني",
                "governorate": "سوريا",
                "field": "عام",
                "type": job_type,  # سيتم وضع التصنيف هنا تلقائياً
                "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                "description": text,
                "source": "https://t.me/wazafne175",
                "status": "pending"
            }
            jobs.append(job)
            
        return jobs
    except Exception as e:
        print(f"حدث خطأ أثناء السحب: {e}")
        return []

def save_to_supabase(jobs):
    if supabase is None:
        raise RuntimeError("لم يتم ضبط SUPABASE_URL وSUPABASE_KEY")
    for job in jobs:
        try:
            # البحث بالعنوان لمنع التكرار
            check = supabase.table("job_submissions").select("id").eq("title", job['title']).execute()
            if not check.data:
                supabase.table("job_submissions").insert(job, returning="minimal").execute()
                print(f"تمت إضافة: {job['title']} (النوع: {job['type']})")
            else:
                print(f"موجود مسبقاً: {job['title']}")
        except Exception as e:
            print(f"خطأ في الإدخال: {e}")

if __name__ == "__main__":
    delete_old_samples() # 1. حذف التجريبي
    new_jobs = fetch_telegram_jobs() # 2. سحب الجديد
    if new_jobs:
        save_to_supabase(new_jobs)
    else:
        print("لم يتم العثور على إعلانات جديدة.")
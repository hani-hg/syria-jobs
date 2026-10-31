import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime, timedelta

# جلب المفاتيح السرية من إعدادات GitHub
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

# قائمة القنوات التي سنسحب منها
CHANNELS = [
    "wazafne175",  # وظفني
    "syrjob",      # وظائف سوريا (سيرجوب)
    "Jobs_Bank_Syr" # بنك الوظائف
]

def fetch_telegram_jobs():
    print("بدء عملية السحب من القنوات...")
    all_jobs = []
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    gov_keywords = ["وزارة", "مديرية", "مجلس", "هيئة", "حكومة", "الجمهورية العربية السورية", "وزير"]

    for channel in CHANNELS:
        print(f"جاري فحص قناة: {channel}...")
        channel_url = f"https://t.me/s/{channel}"
        
        try:
            response = requests.get(channel_url, headers=headers, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            messages = soup.find_all('div', class_='tgme_widget_message_text')
            
            # أخذ آخر 3 رسائل من كل قناة
            for msg in messages[-3:]:
                text = msg.get_text(separator='\n').strip()
                if len(text) < 30: continue # تجاهل الرسائل القصيرة

                # استخراج أول سطر كعنوان (مع تنظيفه)
                title = text.split('\n')[0][:100].strip()
                if not title: continue
                
                # تحديد النوع تلقائياً
                job_type = "حكومي" if any(word in text for word in gov_keywords) else "خاص"
                
                job = {
                    "title": title,
                    "company": f"من قناة {channel}",
                    "governorate": "سوريا",
                    "field": "عام",
                    "type": job_type,
                    "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                    "description": text,
                    "source": f"https://t.me/{channel}",
                    "status": "pending"
                }
                all_jobs.append(job)
                
        except Exception as e:
            print(f"حدث خطأ في قناة {channel}: {e}")
            
    return all_jobs

def save_to_supabase(jobs):
    added_count = 0
    for job in jobs:
        try:
            # التحقق من التكرار: نبحث عن أول 30 حرف من العنوان
            # هذا يمنع تكرار الإعلان حتى لو نشر في قناتين مختلفتين
            search_title = job['title'][:30]
            check = supabase.table("job_submissions").select("id").ilike("title", f"%{search_title}%").execute()
            
            if not check.data:
                supabase.table("job_submissions").insert(job, returning="minimal").execute()
                print(f"✅ تمت إضافة: {job['title']} (النوع: {job['type']})")
                added_count += 1
            else:
                print(f"⏩ موجود مسبقاً: {job['title']}")
        except Exception as e:
            print(f"❌ خطأ في الإدخال: {e}")
    
    print(f"انتهت العملية. تمت إضافة {added_count} إعلان جديد.")

if __name__ == "__main__":
    new_jobs = fetch_telegram_jobs()
    if new_jobs:
        save_to_supabase(new_jobs)
    else:
        print("لم يتم العثور على إعلانات جديدة.")
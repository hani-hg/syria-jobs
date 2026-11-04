import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime, timedelta

# جلب المفاتيح السرية
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

# القنوات الأربع
CHANNELS = [
    "wazafne175",   # وظفني
    "syrjob",       # وظائف سوريا
    "Jobs_Bank_Syr",# بنك الوظائف
    "SyMOAD"        # وزارة التنمية الإدارية
]

def clean_title(text):
    """دالة لاستخراج عنوان نظيف من النص، وتجاهل الهاشتاقات والرموز"""
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        # تجاهل السطر إذا كان فارغاً، أو يبدأ بـ #، أو رموز تعبيرية، أو قصير جداً
        if line and not line.startswith('#') and len(line) > 5:
            # إزالة الرموز التعبيرية من بداية السطر
            cleaned = re.sub(r'^[^\w\u0600-\u06FF]+', '', line)
            if cleaned:
                return cleaned[:100] # أول 100 حرف
    return "إعلان وظيفة" # عنوان افتراضي إذا لم نجد شيئاً

def fetch_telegram_jobs():
    print("بدء عملية السحب...")
    all_jobs = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    gov_keywords = ["وزارة", "مديرية", "مجلس", "هيئة", "حكومة", "الجمهورية العربية السورية", "وزير", "محافظة"]

    for channel in CHANNELS:
        print(f"جاري فحص: {channel}...")
        try:
            response = requests.get(f"https://t.me/s/{channel}", headers=headers, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            messages = soup.find_all('div', class_='tgme_widget_message_text')
            
            for msg in messages[-3:]:
                text = msg.get_text(separator='\n').strip()
                if len(text) < 30: continue

                # استخراج عنوان نظيف
                title = clean_title(text)
                
                # تحديد النوع
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
            print(f"خطأ في {channel}: {e}")
    return all_jobs

def save_to_supabase(jobs):
    added = 0
    for job in jobs:
        try:
            # منع التكرار بناءً على أول 30 حرف من العنوان
            check = supabase.table("job_submissions").select("id").ilike("title", f"%{job['title'][:30]}%").execute()
            if not check.data:
                supabase.table("job_submissions").insert(job, returning="minimal").execute()
                print(f"✅ تمت إضافة: {job['title']}")
                added += 1
            else:
                print(f"⏩ موجود: {job['title']}")
        except Exception as e:
            print(f"❌ خطأ: {e}")
    print(f"انتهت العملية. تمت إضافة {added} إعلان.")

if __name__ == "__main__":
    new_jobs = fetch_telegram_jobs()
    if new_jobs:
        save_to_supabase(new_jobs)
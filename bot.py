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

CHANNELS = [
    "wazafne175", "syrjob", "Jobs_Bank_Syr", "SyMOAD"
]

def clean_text(text):
    """دالة لتنظيف النص من المشاهدات والهاشتاقات"""
    # حذف سطر المشاهدات
    text = re.sub(r'المشاهدات:\s*\d+', '', text)
    # حذف الهاشتاقات
    text = re.sub(r'#\S+', '', text)
    # حذف الأسطر الفارغة الزائدة
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n'.join(lines)

def clean_title(text):
    """استخراج عنوان نظيف"""
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and len(line) > 10:
            cleaned = re.sub(r'^[^\w\u0600-\u06FF]+', '', line)
            if cleaned:
                return cleaned[:100]
    return "إعلان وظيفة"

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
                raw_text = msg.get_text(separator='\n').strip()
                if len(raw_text) < 30: continue

                # تنظيف النص قبل الحفظ
                cleaned_text = clean_text(raw_text)
                title = clean_title(cleaned_text)
                
                job_type = "حكومي" if any(word in cleaned_text for word in gov_keywords) else "خاص"
                
                job = {
                    "title": title,
                    "company": f"من قناة {channel}",
                    "governorate": "سوريا",
                    "field": "عام",
                    "type": job_type,
                    "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                    "description": cleaned_text, # حفظ النص النظيف
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
            check = supabase.table("job_submissions").select("id").ilike("title", f"%{job['title'][:30]}%").execute()
            if not check.data:
                supabase.table("job_submissions").insert(job, returning="minimal").execute()
                print(f"✅ تمت إضافة: {job['title']}")
                added += 1
        except Exception as e:
            print(f"❌ خطأ: {e}")
    print(f"انتهت العملية. تمت إضافة {added} إعلان.")

if __name__ == "__main__":
    new_jobs = fetch_telegram_jobs()
    if new_jobs:
        save_to_supabase(new_jobs)
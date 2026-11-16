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

# قائمة القنوات الموسعة (8 قنوات)
CHANNELS = [
    "wazafne175",     # وظفني
    "syrjob",         # وظائف سوريا
    "Jobs_Bank_Syr",  # بنك الوظائف
    "SyMOAD",         # وزارة التنمية الإدارية
    "syria_jobs",     # قناة إضافية 1
    "job_syria",      # قناة إضافية 2
    "syrianjobs",     # قناة إضافية 3
    "jobs_in_syria"   # قناة إضافية 4
]

def clean_title(text):
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and len(line) > 10:
            cleaned = re.sub(r'^[^\w\u0600-\u06FF]+', '', line)
            if cleaned:
                return cleaned[:100]
    return "إعلان وظيفة"

def clean_text(text):
    text = re.sub(r'المشاهدات:\s*\d+', '', text)
    text = re.sub(r'#\S+', '', text)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n'.join(lines)

def archive_old_jobs():
    print("جاري أرشفة الإعلانات القديمة...")
    try:
        # حذف الإعلانات التي انتهى تاريخها (أقدم من اليوم)
        today = datetime.now().strftime('%Y-%m-%d')
        supabase.table("job_submissions").delete().lt("deadline", today).execute()
        print("تم حذف الإعلانات المنتهية.")
    except Exception as e:
        print(f"خطأ في الأرشفة: {e}")

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
            
            for msg in messages[-2:]: # سحب آخر إعلانين فقط من كل قناة لتجنب التكرار
                raw_text = msg.get_text(separator='\n').strip()
                if len(raw_text) < 30: continue

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
                    "description": cleaned_text,
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
            check = supabase.table("job_submissions").select("id").eq("title", job['title']).execute()
            if not check.data:
                supabase.table("job_submissions").insert(job).execute()
                print(f"✅ تمت إضافة: {job['title']}")
                added += 1
            else:
                print(f"⏩ موجود مسبقاً: {job['title']}")
        except Exception as e:
            print(f"❌ خطأ في الإدخال: {e}")
    print(f"انتهت العملية. تمت إضافة {added} إعلان.")

if __name__ == "__main__":
    archive_old_jobs() # 1. حذف المنتهي
    new_jobs = fetch_telegram_jobs() # 2. جلب الجديد
    if new_jobs:
        save_to_supabase(new_jobs)
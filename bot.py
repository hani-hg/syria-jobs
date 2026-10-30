import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime, timedelta

# جلب المفاتيح السرية من إعدادات GitHub
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

def fetch_telegram_jobs():
    print("جاري الاتصال بقناة وظفني...")
    # رابط المعاينة العامة لقناة وظفني
    channel_url = "https://t.me/s/wazafne175"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(channel_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # استخراج الرسائل من الصفحة
        messages = soup.find_all('div', class_='tgme_widget_message_text')
        jobs = []
        
        # أخذ آخر 5 رسائل فقط لتجنب التكرار والضغط على القاعدة
        for msg in messages[-5:]:
            text = msg.get_text(separator='\n').strip()
            
            # تجاهل الرسائل القصيرة جداً (قد تكون صوراً أو تعليقات)
            if len(text) < 30:
                continue

            # استخراج أول سطر كعنوان للوظيفة
            lines = text.split('\n')
            title = lines[0][:100] # أول 100 حرف كعنوان
            
            # تجهيز البيانات للإدخال
            job = {
                "title": title,
                "company": "غير محدد", # القناة لا توفر الشركة دائماً
                "governorate": "غير محدد",
                "field": "عام",
                "type": "خاص",
                "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'), # تاريخ افتراضي بعد أسبوعين
                "description": text,
                "source": f"https://t.me/wazafne175",
                "status": "pending"
            }
            jobs.append(job)
            
        return jobs
        
    except Exception as e:
        print(f"حدث خطأ أثناء السحب: {e}")
        return []

def save_to_supabase(jobs):
    for job in jobs:
        try:
            # التحقق من عدم وجود الإعلان مسبقاً بناءً على أول 50 حرف من الوصف
            # (لأن القناة لا توفر معرّفاً فريداً لكل إعلان)
            check = supabase.table("job_submissions").select("id").ilike("description", f"%{job['description'][:50]}%").execute()
            
            if not check.data:
                supabase.table("job_submissions").insert(job, returning="minimal").execute()
                print(f"تمت إضافة: {job['title']}")
            else:
                print(f"موجود مسبقاً: {job['title']}")
        except Exception as e:
            print(f"خطأ في الإدخال: {e}")

if __name__ == "__main__":
    new_jobs = fetch_telegram_jobs()
    if new_jobs:
        save_to_supabase(new_jobs)
    else:
        print("لم يتم العثور على إعلانات جديدة.")
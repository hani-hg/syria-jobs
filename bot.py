import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from datetime import datetime, timedelta

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHANNEL_ID") or "@syrianjobs_sy"

supabase = create_client(URL, KEY)

def clean_title(text):
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and len(line) > 10:
            # إزالة الإيموجي والرموز من بداية السطر
            cleaned = re.sub(r'^[^\w\u0600-\u06FF]+', '', line)
            if cleaned: return cleaned[:100]
    return "إعلان وظيفة"

def fetch_and_save():
    print("بدء السحب...")
    channels = ["wazafne175", "syrjob"]
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for channel in channels:
        try:
            res = requests.get(f"https://t.me/s/{channel}", headers=headers, timeout=10)
            soup = BeautifulSoup(res.text, 'html.parser')
            msgs = soup.find_all('div', class_='tgme_widget_message_text')
            
            for msg in msgs[-1:]:
                text = msg.get_text(separator='\n').strip()
                if len(text) < 30: continue
                
                title = clean_title(text)
                job = {
                    "title": title, "company": f"من {channel}", "governorate": "سوريا",
                    "field": "عام", "type": "خاص", "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                    "description": text[:500], "source": f"https://t.me/{channel}", "status": "pending"
                }
                
                try:
                    supabase.table("job_submissions").insert(job).execute()
                    print(f"تم الحفظ في الموقع: {title}")
                except Exception as e:
                    print(f"خطأ في قاعدة البيانات: {e}")
                    continue

                if BOT_TOKEN and CHAT_ID:
                    telegram_msg = f"💼 {title}\n\n{text[:200]}...\n\n🔗 {job['source']}"
                    tg_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
                    r = requests.post(tg_url, json={"chat_id": CHAT_ID, "text": telegram_msg})
                    if r.status_code == 200:
                        print("✅ تم النشر في تيليجرام بنجاح")
                    else:
                        print(f"❌ فشل تيليجرام: {r.text}")
                else:
                    print("❌ التوكن أو رقم القناة غير موجود")
                    
        except Exception as e:
            print(f"خطأ: {e}")

if __name__ == "__main__":
    fetch_and_save()
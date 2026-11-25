import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime, timedelta

URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL:
    raise RuntimeError("Missing required GitHub Actions secret: SUPABASE_URL.")
if not SERVICE_ROLE_KEY:
    raise RuntimeError("Missing required GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY; refusing to fall back to SUPABASE_KEY.")
print("Supabase authentication: required SUPABASE_SERVICE_ROLE_KEY is present.")
supabase: Client = create_client(URL, SERVICE_ROLE_KEY)

# توكن البوت الذي أضفته كمشرف (يجب أن يكون في أسرار GitHub)
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "@syrianjobs_sy").strip()

CHANNELS = [
    "wazafne175", "syrjob", "Jobs_Bank_Syr", "SyMOAD",
    "syria_jobs", "job_syria", "syrianjobs", "jobs_in_syria"
]

def send_to_telegram(title, text, source):
    if not BOT_TOKEN:
        print("تعذر النشر إلى Telegram: سر TELEGRAM_BOT_TOKEN غير مضبوط.")
        return False
    if not TELEGRAM_CHANNEL_ID:
        print("تعذر النشر إلى Telegram: وجهة القناة غير مضبوطة؛ لن يُستخدم TELEGRAM_CHAT_ID القديم.")
        return False

    # Plain text avoids Telegram HTML parse errors; no parse_mode is sent.
    message = f"💼 {title or 'إعلان وظيفة'}\n\n{(text or '')[:800]}\n\nرابط الإعلان الأصلي: {source or ''}\n\n#وظائف_سوريا"
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHANNEL_ID, "text": message}
    try:
        response = requests.post(url, json=payload, timeout=20)
        print(f"Telegram response: status_code={response.status_code}, text={response.text}")
        try:
            result = response.json()
        except ValueError:
            result = None

        if not response.ok or (isinstance(result, dict) and not result.get("ok", False)):
            print(f"فشل النشر إلى Telegram (HTTP {response.status_code}).")
            return False

        print(f"تم النشر إلى Telegram بنجاح (HTTP {response.status_code}).")
        return True
    except Exception as e:
        print(f"خطأ في النشر للقناة: {e}")
        return False

def clean_title(text):
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and len(line) > 10:
            cleaned = re.sub(r'^[^\w\u0600-\u06FF]+', '', line)
            if cleaned: return cleaned[:100]
    return "إعلان وظيفة"

def clean_text(text):
    text = re.sub(r'المشاهدات:\s*\d+', '', text)
    text = re.sub(r'#\S+', '', text)
    return '\n'.join([line.strip() for line in text.split('\n') if line.strip()])

def archive_old_jobs():
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        supabase.table("job_submissions").delete().lt("deadline", today).execute()
        print("تم حذف الإعلانات المنتهية.")
    except Exception as e:
        print(f"خطأ في الأرشفة: {e}")
        raise RuntimeError("Expired-job cleanup failed; verify SUPABASE_SERVICE_ROLE_KEY and table permissions.") from e

def fetch_telegram_jobs():
    all_jobs = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    gov_keywords = ["وزارة", "مديرية", "مجلس", "هيئة", "حكومة", "الجمهورية العربية السورية", "وزير", "محافظة"]

    for channel in CHANNELS:
        try:
            response = requests.get(f"https://t.me/s/{channel}", headers=headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
            messages = soup.find_all('div', class_='tgme_widget_message_text')
            
            for msg in messages[-2:]:
                raw_text = msg.get_text(separator='\n').strip()
                if len(raw_text) < 30: continue
                cleaned_text = clean_text(raw_text)
                title = clean_title(cleaned_text)
                job_type = "حكومي" if any(word in cleaned_text for word in gov_keywords) else "خاص"
                
                job = {
                    "title": title, "company": f"من قناة {channel}", "governorate": "سوريا",
                    "field": "عام", "type": job_type, 
                    "deadline": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                    "description": cleaned_text, "source": f"https://t.me/{channel}", "status": "pending"
                }
                all_jobs.append(job)
        except Exception as e:
            print(f"خطأ في {channel}: {e}")
    return all_jobs

def save_to_supabase(jobs):
    added = 0
    duplicates = 0
    telegram_sent = 0
    telegram_failed = 0
    database_failed = 0
    for job in jobs:
        try:
            check = supabase.table("job_submissions").select("id").eq("title", job['title']).execute()
            if not check.data:
                supabase.table("job_submissions").insert(job).execute()
                print(f"✅ تمت إضافة: {job['title']}")
                added += 1
                # إرسال الإعلان إلى قناة تيليجرام الجديدة
                if send_to_telegram(job['title'], job['description'], job['source']):
                    telegram_sent += 1
                else:
                    telegram_failed += 1
            else:
                duplicates += 1
                print(f"⏩ موجود مسبقاً؛ لن يُعاد نشره إلى Telegram: {job['title']}")
        except Exception as e:
            database_failed += 1
            print(f"❌ خطأ في الإدخال: {e}")
    print(
        "ملخص التشغيل: "
        f"تمت الإضافة={added}، مكرر={duplicates}، "
        f"نشر Telegram ناجح={telegram_sent}، فشل Telegram={telegram_failed}، "
        f"فشل قاعدة البيانات={database_failed}"
    )
    if database_failed:
        raise RuntimeError(f"{database_failed} database operation(s) failed; see the log lines above.")
    if telegram_failed:
        raise RuntimeError(f"{telegram_failed} Telegram send(s) failed; see response logs above.")

if __name__ == "__main__":
    archive_old_jobs()
    new_jobs = fetch_telegram_jobs()
    if new_jobs: save_to_supabase(new_jobs)

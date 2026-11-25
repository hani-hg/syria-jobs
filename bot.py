import hashlib
import os
import re
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

supabase = None


def create_supabase_client():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("Missing required GitHub Actions secret: SUPABASE_URL.")
    if not service_role_key:
        raise RuntimeError(
            "Missing required GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY; "
            "refusing to fall back to SUPABASE_KEY."
        )
    print("Supabase authentication: required SUPABASE_SERVICE_ROLE_KEY is present.")
    return create_client(url, service_role_key)


def load_telegram_bot_token(environ=None):
    """Read the configured GitHub Actions secret without logging any token characters."""
    source = os.environ if environ is None else environ
    return (source.get("TELEGRAM_BOT_TOKEN") or "").strip()


# GitHub Actions secret name: TELEGRAM_BOT_TOKEN. Never print or partially expose its value.
BOT_TOKEN = load_telegram_bot_token()
print(f"Telegram bot token configured: {'yes' if BOT_TOKEN else 'no'}")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "@syrianjobs_sy").strip()

CHANNELS = [
    "wazafne175", "syrjob", "Jobs_Bank_Syr", "SyMOAD",
    "syria_jobs", "job_syria", "syrianjobs", "jobs_in_syria"
]
MAX_TELEGRAM_TEXT_CHARS = 500


def make_delivery_identity(channel, post_reference, text):
    """Return a stable deduplication key and the best available source URL."""
    reference = (post_reference or "").strip().strip("/")
    if re.fullmatch(r"[A-Za-z0-9_]+/\d+", reference):
        return f"telegram:{reference}", f"https://t.me/{reference}"

    normalized_text = re.sub(r"\s+", " ", text or "").strip()
    payload = f"{channel}\n{normalized_text}".encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    return f"sha256:{digest}", f"https://t.me/{channel}"


def build_telegram_message(title, text, source):
    # Keep the announcement plain and bounded; inline links remain available in the source post.
    excerpt = (text or "")[:MAX_TELEGRAM_TEXT_CHARS]
    excerpt = re.sub(r"(?:https?://|www\.)[^\s]+", "[رابط في المصدر الأصلي]", excerpt)
    excerpt = excerpt[:MAX_TELEGRAM_TEXT_CHARS]
    safe_title = (title or "إعلان وظيفة")[:100]
    safe_source = (source or "")[:256]
    return f"{safe_title}\n\n{excerpt}\n\nالمصدر: {safe_source}"


def send_to_telegram(title, text, source):
    if not BOT_TOKEN:
        error = "سر TELEGRAM_BOT_TOKEN غير مضبوط."
        print(f"تعذر النشر إلى Telegram: {error}")
        return {"ok": False, "message_id": None, "error": error}
    if not TELEGRAM_CHANNEL_ID:
        error = "وجهة القناة غير مضبوطة؛ لن يُستخدم TELEGRAM_CHAT_ID القديم."
        print(f"تعذر النشر إلى Telegram: {error}")
        return {"ok": False, "message_id": None, "error": error}

    # Plain text avoids Telegram HTML/Markdown parse errors; no parse_mode is sent.
    message = build_telegram_message(title, text, source)
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHANNEL_ID, "text": message}
    try:
        response = requests.post(url, json=payload, timeout=20)
        print(f"Telegram response: status_code={response.status_code}, text={response.text}")
        try:
            result = response.json()
        except ValueError:
            result = None

        if not response.ok or not isinstance(result, dict) or result.get("ok") is not True:
            description = result.get("description") if isinstance(result, dict) else response.text
            error = f"HTTP {response.status_code}: {description or response.text}"
            print(f"فشل النشر إلى Telegram ({error}).")
            return {"ok": False, "message_id": None, "error": error}

        message_id = None
        if isinstance(result, dict):
            message_id = (result.get("result") or {}).get("message_id")
        print(f"تم النشر إلى Telegram بنجاح (HTTP {response.status_code}).")
        return {"ok": True, "message_id": message_id, "error": None}
    except Exception as exc:
        error = str(exc)
        if BOT_TOKEN:
            error = error.replace(BOT_TOKEN, "[REDACTED]")
        print(f"خطأ في النشر للقناة: {error}")
        return {"ok": False, "message_id": None, "error": error}


def clean_title(text):
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#") and len(line) > 10:
            cleaned = re.sub(r"^[^\w\u0600-\u06FF]+", "", line)
            if cleaned:
                return cleaned[:100]
    return "إعلان وظيفة"


def clean_text(text):
    text = re.sub(r"المشاهدات:\s*\d+", "", text)
    text = re.sub(r"#\S+", "", text)
    return "\n".join([line.strip() for line in text.split("\n") if line.strip()])


def archive_old_jobs():
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        supabase.table("job_submissions").delete().lt("deadline", today).execute()
        print("تم حذف الإعلانات المنتهية.")
    except Exception as exc:
        print(f"خطأ في الأرشفة: {exc}")
        raise RuntimeError(
            "Expired-job cleanup failed; verify SUPABASE_SERVICE_ROLE_KEY and table permissions."
        ) from exc


def fetch_telegram_jobs():
    all_jobs = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    gov_keywords = ["وزارة", "مديرية", "مجلس", "هيئة", "حكومة", "الجمهورية العربية السورية", "وزير", "محافظة"]

    for channel in CHANNELS:
        try:
            response = requests.get(f"https://t.me/s/{channel}", headers=headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            messages = soup.find_all("div", class_="tgme_widget_message_text")

            for msg in messages[-2:]:
                raw_text = msg.get_text(separator="\n").strip()
                if len(raw_text) < 30:
                    continue
                cleaned_text = clean_text(raw_text)
                title = clean_title(cleaned_text)
                job_type = "حكومي" if any(word in cleaned_text for word in gov_keywords) else "خاص"

                message_container = msg.find_parent("div", class_="tgme_widget_message")
                post_reference = message_container.get("data-post") if message_container else None
                delivery_key, source_url = make_delivery_identity(channel, post_reference, cleaned_text)

                job = {
                    "title": title,
                    "company": f"من قناة {channel}",
                    "governorate": "سوريا",
                    "field": "عام",
                    "type": job_type,
                    "deadline": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
                    "description": cleaned_text,
                    "source": source_url,
                    "status": "pending",
                    "_telegram_delivery_key": delivery_key,
                }
                all_jobs.append(job)
        except Exception as exc:
            print(f"خطأ في {channel}: {exc}")
    return all_jobs


def _claim_telegram_delivery(client, job, delivery_key):
    response = client.rpc(
        "claim_telegram_delivery",
        {
            "p_source_key": delivery_key,
            "p_source_message_url": job.get("source") or "",
            "p_channel_id": TELEGRAM_CHANNEL_ID,
            "p_title": job.get("title") or "إعلان وظيفة",
        },
    ).execute()
    rows = response.data or []
    return bool(rows and isinstance(rows[0], dict) and rows[0].get("claimed") is True)


def _record_telegram_result(client, delivery_key, send_result):
    sent = send_result.get("ok") is True
    update = {
        "status": "sent" if sent else "failed",
        "telegram_message_id": send_result.get("message_id") if sent else None,
        "sent_at": datetime.now(timezone.utc).isoformat() if sent else None,
        "last_error": None if sent else (send_result.get("error") or "Unknown Telegram error")[:1000],
    }
    client.table("telegram_delivery_log").update(update).eq("source_key", delivery_key).execute()


def save_to_supabase(jobs):
    added = 0
    duplicates = 0
    telegram_sent = 0
    telegram_failed = 0
    telegram_skipped = 0
    database_failed = 0
    delivery_log_failed = 0
    client = supabase
    if client is None:
        client = create_supabase_client()

    for job in jobs:
        job_data = {key: value for key, value in job.items() if key != "_telegram_delivery_key"}
        delivery_key = job.get("_telegram_delivery_key")
        if not delivery_key:
            channel = (job.get("company") or "").removeprefix("من قناة ")
            delivery_key, _ = make_delivery_identity(channel, None, job.get("description", ""))

        # Database duplicate detection is deliberately independent from Telegram delivery.
        try:
            check = client.table("job_submissions").select("id").eq("title", job_data["title"]).execute()
            if not check.data:
                client.table("job_submissions").insert(job_data).execute()
                print(f"✅ تمت إضافة: {job_data['title']}")
                added += 1
            else:
                duplicates += 1
                print(f"⏩ موجود مسبقاً في job_submissions: {job_data['title']}")
        except Exception as exc:
            database_failed += 1
            print(f"❌ خطأ في قاعدة الوظائف: {exc}")

        # The separate ledger, not job_submissions, decides whether Telegram is attempted.
        try:
            claimed = _claim_telegram_delivery(client, job_data, delivery_key)
            if not claimed:
                telegram_skipped += 1
                print(f"⏭️ سبق تسليم الرسالة أو توجد مطالبة نشطة؛ لن تتكرر: {job_data['title']}")
                continue

            send_result = send_to_telegram(
                job_data.get("title"), job_data.get("description"), job_data.get("source")
            )
            try:
                _record_telegram_result(client, delivery_key, send_result)
            except Exception as exc:
                delivery_log_failed += 1
                print(
                    "تعذر تحديث سجل التسليم بعد محاولة Telegram؛ راجع حالة الرسالة يدويًا "
                    f"قبل إعادة التشغيل: {exc}"
                )

            if send_result.get("ok") is True:
                telegram_sent += 1
            else:
                telegram_failed += 1
        except Exception as exc:
            delivery_log_failed += 1
            print(f"❌ تعذر المطالبة بتسليم Telegram أو تحديث السجل: {exc}")

    summary = {
        "added": added,
        "duplicates": duplicates,
        "telegram_sent": telegram_sent,
        "telegram_failed": telegram_failed,
        "telegram_skipped": telegram_skipped,
        "database_failed": database_failed,
        "delivery_log_failed": delivery_log_failed,
    }
    print(
        "ملخص التشغيل: "
        f"تمت الإضافة={added}، مكرر في قاعدة الوظائف={duplicates}، "
        f"نشر Telegram ناجح={telegram_sent}، فشل Telegram={telegram_failed}، "
        f"تخطي Telegram={telegram_skipped}، فشل قاعدة البيانات={database_failed}، "
        f"فشل سجل التسليم={delivery_log_failed}"
    )
    if delivery_log_failed:
        raise RuntimeError(f"{delivery_log_failed} Telegram delivery-ledger operation(s) failed.")
    if database_failed:
        raise RuntimeError(f"{database_failed} database operation(s) failed; see the log lines above.")
    return summary


if __name__ == "__main__":
    supabase = create_supabase_client()
    archive_old_jobs()
    new_jobs = fetch_telegram_jobs()
    if new_jobs:
        save_to_supabase(new_jobs)

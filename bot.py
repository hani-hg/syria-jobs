import os
import requests

# جلب المفاتيح
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHANNEL_ID")

print(f"التوكن: {BOT_TOKEN[:5] if BOT_TOKEN else 'غير موجود'}")
print(f"رقم القناة: {CHAT_ID}")

if not BOT_TOKEN or not CHAT_ID:
    print("❌ الخطأ: التوكن أو رقم القناة غير موجود في إعدادات GitHub.")
    exit(1)

# محاولة إرسال رسالة تجريبية
message = "✅ تجربة إرسال من البوت إلى القناة بنجاح!"
url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
payload = {"chat_id": CHAT_ID, "text": message}

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        print("✅ تم إرسال الرسالة إلى القناة بنجاح.")
    else:
        print(f"❌ فشل الإرسال. رد تيليجرام: {response.text}")
except Exception as e:
    print(f"❌ خطأ في الاتصال: {e}")
import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# جلب المفاتيح السرية من إعدادات GitHub
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

def scrape_jobs():
    # (هذا الكود التجريبي يجلب بيانات وهمية حالياً، لاحقاً سنربطه بموقع حقيقي)
    print("جاري البحث عن وظائف جديدة...")
    jobs = [
        {
            "title": "مطور ويب (إعلان تجريبي من البوت)",
            "company": "شركة تقنية سورية",
            "governorate": "دمشق",
            "field": "تقنية المعلومات",
            "type": "خاص",
            "deadline": "2026-12-31",
            "description": "هذا إعلان تم سحبه تلقائياً بواسطة البوت التجريبي للتأكد من أن كل شيء يعمل.",
            "source": "https://example.com",
            "status": "pending" # يذهب للمراجعة
        }
    ]
    return jobs

def save_to_supabase(jobs):
    for job in jobs:
        # التحقق من عدم وجود الإعلان مسبقاً (لمنع التكرار)
        response = supabase.table("job_submissions").select("id").eq("title", job["title"]).execute()
        if not response.data:
            supabase.table("job_submissions").insert(job, returning="minimal").execute()
            print(f"تمت إضافة: {job['title']}")
        else:
            print(f"موجود مسبقاً: {job['title']}")

if __name__ == "__main__":
    new_jobs = scrape_jobs()
    save_to_supabase(new_jobs)
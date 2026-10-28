const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const sampleJobs = [
  { id: 'job-1', title: 'مهندس برمجيات', company: 'شركة تقنية سورية', governorate: 'دمشق', field: 'تقنية المعلومات', type: 'خاص', deadline: '2026-12-20', description: 'تطوير وصيانة تطبيقات الويب والعمل ضمن فريق تقني متكامل.', source: 'https://www.linkedin.com/jobs/' },
  { id: 'job-2', title: 'مدرس لغة إنكليزية', company: 'مديرية التربية', governorate: 'حلب', field: 'التعليم', type: 'حكومي', deadline: '2026-11-30', description: 'فرصة تدريس للمدارس العامة وفق الشروط المعلنة من الجهة الرسمية.', source: 'https://moed.gov.sy/' },
  { id: 'job-3', title: 'محاسب', company: 'مؤسسة تجارية', governorate: 'حمص', field: 'المحاسبة والمال', type: 'خاص', deadline: '2026-12-10', description: 'إدارة الحسابات وإعداد التقارير المالية ومتابعة الفواتير.', source: 'https://example.com/jobs/accountant' },
  { id: 'job-4', title: 'طبيب مقيم', company: 'وزارة الصحة', governorate: 'اللاذقية', field: 'الطب والرعاية الصحية', type: 'حكومي', deadline: '2026-12-05', description: 'شواغر للأطباء المقيمين بحسب الاختصاصات والأماكن المتاحة.', source: 'https://moh.gov.sy/' }
];

let allJobs = [];
let visibleJobs = [];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const isActive = (job) => job.deadline && new Date(`${job.deadline}T23:59:59`) >= new Date();
const formatDate = (date) => new Intl.DateTimeFormat('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));

async function loadJobs() {
  try {
    const { data, error } = await supabaseClient.from('job_submissions').select('id,title,company,governorate,field,type,deadline,description,source').eq('status', 'approved').order('created_at', { ascending: false });
    if (error) throw error;
    allJobs = [...(data || []), ...sampleJobs].filter(isActive);
  } catch (error) {
    console.error('تعذر تحميل الوظائف من Supabase:', error);
    allJobs = sampleJobs.filter(isActive);
    showToast('تعذر الاتصال بقاعدة البيانات، عُرضت الوظائف التجريبية.', 'error');
  }
  populateFilters();
  applyFilters();
}

function populateFilters() {
  const values = (key) => [...new Set(allJobs.map((job) => job[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  $('#governorateFilter').innerHTML = '<option value="">كل المحافظات</option>' + values('governorate').map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  $('#fieldFilter').innerHTML = '<option value="">كل المجالات</option>' + values('field').map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function applyFilters() {
  const search = $('#searchInput').value.trim().toLowerCase();
  const governorate = $('#governorateFilter').value;
  const field = $('#fieldFilter').value;
  const type = $('#typeFilter').value;
  visibleJobs = allJobs.filter((job) => {
    const haystack = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    return (!search || haystack.includes(search)) && (!governorate || job.governorate === governorate) && (!field || job.field === field) && (!type || job.type === type);
  });
  renderJobs();
}

function renderJobs() {
  $('#heroCount').textContent = allJobs.length;
  $('#resultsCount').textContent = `${visibleJobs.length} إعلان`;
  if (!visibleJobs.length) { $('#jobsGrid').innerHTML = '<div class="empty-state"><strong>لا توجد نتائج مطابقة</strong><span>جرّب تغيير الفلاتر أو كلمة البحث.</span></div>'; return; }
  $('#jobsGrid').innerHTML = visibleJobs.map((job) => `
    <article class="job-card"><div class="job-top"><span class="job-type ${job.type === 'حكومي' ? 'government' : 'private'}">${escapeHtml(job.type)}</span><span class="job-date">حتى ${formatDate(job.deadline)}</span></div>
      <h3>${escapeHtml(job.title)}</h3><p class="company">${escapeHtml(job.company)}</p><div class="job-meta"><span>⌖ ${escapeHtml(job.governorate)}</span><span>◈ ${escapeHtml(job.field)}</span></div><p class="job-description">${escapeHtml(job.description)}</p>
      <div class="job-actions"><a class="btn btn-source" href="${escapeHtml(job.source)}" target="_blank" rel="noopener noreferrer">رابط المصدر</a><button class="btn btn-whatsapp" type="button" onclick="shareJob('${escapeHtml(job.id)}')">واتساب</button></div>
    </article>`).join('');
}

function shareJob(id) {
  const job = allJobs.find((item) => item.id === id); if (!job) return;
  const url = new URL(window.location.href); url.hash = 'jobs';
  const text = `فرصة عمل عبر وظائف سوريا\n${job.title} - ${job.company}\nالمحافظة: ${job.governorate}\nآخر موعد: ${formatDate(job.deadline)}\n${url.toString()}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

function showToast(message, type = 'success') {
  const toast = $('#toast'); toast.textContent = message; toast.className = `toast show ${type}`;
  window.setTimeout(() => { toast.className = 'toast'; }, 4500);
}

async function handlePublish(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());
  button.disabled = true; button.textContent = 'جارٍ الإرسال...';
  try {
    const { error } = await supabaseClient.from('job_submissions').insert({
      title: data.title.trim(), company: data.company.trim(), governorate: data.governorate.trim(), field: data.field.trim(),
      type: 'خاص', deadline: data.deadline, source: data.source.trim(), description: data.description.trim(), status: 'pending'
    });
    if (error) throw error;
    form.reset();
    showToast('تم حفظ طلبك بنجاح، وهو الآن قيد المراجعة.');
  } catch (error) {
    console.error('فشل حفظ طلب التوظيف:', error);
    showToast('تعذر حفظ الطلب. تأكد من إعداد جدول Supabase وسياسات RLS.', 'error');
  } finally { button.disabled = false; button.textContent = 'إرسال للمراجعة'; }
}

function toggleMenu() { document.querySelector('.main-nav').classList.toggle('open'); }
window.applyFilters = applyFilters; window.shareJob = shareJob; window.toggleMenu = toggleMenu;
document.addEventListener('DOMContentLoaded', () => { $('#publishForm').addEventListener('submit', handlePublish); loadJobs(); });

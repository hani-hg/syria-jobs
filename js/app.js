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

function loadJobs() {
  const submitted = JSON.parse(localStorage.getItem('وظائف-سوريا-قيد-المراجعة') || '[]');
  allJobs = [...sampleJobs, ...submitted].filter(isActive);
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
  if (!visibleJobs.length) {
    $('#jobsGrid').innerHTML = '<div class="empty-state"><strong>لا توجد نتائج مطابقة</strong><span>جرّب تغيير الفلاتر أو كلمة البحث.</span></div>';
    return;
  }
  $('#jobsGrid').innerHTML = visibleJobs.map((job) => `
    <article class="job-card">
      <div class="job-top"><span class="job-type ${job.type === 'حكومي' ? 'government' : 'private'}">${escapeHtml(job.type)}</span><span class="job-date">حتى ${formatDate(job.deadline)}</span></div>
      <h3>${escapeHtml(job.title)}</h3><p class="company">${escapeHtml(job.company)}</p>
      <div class="job-meta"><span>⌖ ${escapeHtml(job.governorate)}</span><span>◈ ${escapeHtml(job.field)}</span></div>
      <p class="job-description">${escapeHtml(job.description)}</p>
      <div class="job-actions"><a class="btn btn-source" href="${escapeHtml(job.source)}" target="_blank" rel="noopener noreferrer">رابط المصدر</a><button class="btn btn-whatsapp" type="button" onclick="shareJob('${escapeHtml(job.id)}')">واتساب</button></div>
    </article>`).join('');
}

function shareJob(id) {
  const job = allJobs.find((item) => item.id === id);
  if (!job) return;
  const url = new URL(window.location.href);
  url.hash = 'jobs';
  const text = `فرصة عمل عبر وظائف سوريا\n${job.title} - ${job.company}\nالمحافظة: ${job.governorate}\nآخر موعد: ${formatDate(job.deadline)}\n${url.toString()}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

function showToast(message, type = 'success') {
  const toast = $('#toast'); toast.textContent = message; toast.className = `toast show ${type}`;
  window.setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function handlePublish(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const pending = JSON.parse(localStorage.getItem('وظائف-سوريا-قيد-المراجعة') || '[]');
  pending.unshift({ ...data, id: `pending-${Date.now()}`, type: 'خاص', status: 'pending' });
  localStorage.setItem('وظائف-سوريا-قيد-المراجعة', JSON.stringify(pending));
  event.currentTarget.reset();
  showToast('تم استلام الإعلان، وهو الآن قيد المراجعة.');
}

function toggleMenu() { document.querySelector('.main-nav').classList.toggle('open'); }

window.applyFilters = applyFilters;
window.shareJob = shareJob;
window.toggleMenu = toggleMenu;
document.addEventListener('DOMContentLoaded', () => { $('#publishForm').addEventListener('submit', handlePublish); loadJobs(); });

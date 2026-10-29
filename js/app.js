const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const GOVERNORATES = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'درعا', 'السويداء', 'القنيطرة', 'دير الزور', 'الحسكة', 'الرقة'];
const FIELDS = ['تقنية المعلومات', 'التعليم', 'الطب والرعاية الصحية', 'المحاسبة والمال', 'الهندسة', 'الإدارة', 'المبيعات والتسويق', 'القانون', 'الإعلام', 'الخدمات', 'النقل واللوجستيات', 'الصناعة', 'الزراعة', 'السياحة والضيافة', 'أخرى'];
const PAGE_SIZE = 6;
const FAV_KEY = 'syria-jobs-favs';
const DUP_KEY = 'syria-jobs-recent-subs';
const sampleJobs = [
  { id: 'job-1', title: 'مهندس برمجيات', company: 'شركة تقنية سورية', governorate: 'دمشق', field: 'تقنية المعلومات', type: 'خاص', deadline: '2026-12-20', description: 'تطوير وصيانة تطبيقات الويب والعمل ضمن فريق تقني متكامل.', source: 'https://www.linkedin.com/jobs/', contact: '' },
  { id: 'job-2', title: 'مدرس لغة إنكليزية', company: 'مديرية التربية', governorate: 'حلب', field: 'التعليم', type: 'حكومي', deadline: '2026-11-30', description: 'فرصة تدريس للمدارس العامة وفق الشروط المعلنة من الجهة الرسمية.', source: 'https://moed.gov.sy/', contact: '' },
  { id: 'job-3', title: 'محاسب', company: 'مؤسسة تجارية', governorate: 'حمص', field: 'المحاسبة والمال', type: 'خاص', deadline: '2026-12-10', description: 'إدارة الحسابات وإعداد التقارير المالية ومتابعة الفواتير.', source: 'https://example.com/jobs/accountant', contact: '' },
  { id: 'job-4', title: 'طبيب مقيم', company: 'وزارة الصحة', governorate: 'اللاذقية', field: 'الطب والرعاية الصحية', type: 'حكومي', deadline: '2026-12-05', description: 'شواغر للأطباء المقيمين بحسب الاختصاصات والأماكن المتاحة.', source: 'https://moh.gov.sy/', contact: '' }
];

let allJobs = [];
let visibleJobs = [];
let shownCount = PAGE_SIZE;
let favOnly = false;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const isActive = (job) => job.deadline && new Date(`${job.deadline}T23:59:59`) >= new Date();
const formatDate = (date) => new Intl.DateTimeFormat('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
const getFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } };
const setFavs = (ids) => localStorage.setItem(FAV_KEY, JSON.stringify(ids));
const isFav = (id) => getFavs().includes(String(id));

function fillSelect(el, items, placeholder) {
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` + items.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

async function loadJobs() {
  try {
    const { data, error } = await supabaseClient.from('job_submissions').select('id,title,company,governorate,field,type,deadline,description,source,contact').eq('status', 'approved').order('created_at', { ascending: false });
    if (error) throw error;
    allJobs = [...(data || []), ...sampleJobs].filter(isActive);
  } catch {
    try {
      const { data, error } = await supabaseClient.from('job_submissions').select('id,title,company,governorate,field,type,deadline,description,source').eq('status', 'approved').order('created_at', { ascending: false });
      if (error) throw error;
      allJobs = [...(data || []), ...sampleJobs].filter(isActive);
    } catch (error) {
      console.error('تعذر تحميل الوظائف من Supabase:', error);
      allJobs = sampleJobs.filter(isActive);
      showToast('تعذر الاتصال بقاعدة البيانات، عُرضت الوظائف التجريبية.', 'error');
    }
  }
  applyFilters();
  openJobFromHash();
}

function applyFilters() {
  const search = ($('#searchInput')?.value || '').trim().toLowerCase();
  const governorate = $('#governorateFilter')?.value || '';
  const field = $('#fieldFilter')?.value || '';
  const type = $('#typeFilter')?.value || '';
  visibleJobs = allJobs.filter((job) => {
    const haystack = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    const matches = (!search || haystack.includes(search)) && (!governorate || job.governorate === governorate) && (!field || job.field === field) && (!type || job.type === type);
    return matches && (!favOnly || isFav(job.id));
  });
  shownCount = PAGE_SIZE;
  renderJobs();
}

function renderJobs() {
  const favs = getFavs();
  $('#heroCount').textContent = allJobs.length;
  $('#heroFavCount').textContent = favs.length;
  $('#favsNav').textContent = favs.length ? `المفضلة (${favs.length})` : 'المفضلة';
  $('#jobsHeading').textContent = favOnly ? 'وظائفك المحفوظة' : 'أحدث الإعلانات';
  $('#resultsCount').textContent = `${visibleJobs.length} إعلان`;
  if (!visibleJobs.length) {
    $('#jobsGrid').innerHTML = `<div class="empty-state"><strong>${favOnly ? 'لا توجد وظائف محفوظة' : 'لا توجد نتائج مطابقة'}</strong><span>${favOnly ? 'اضغط القلب على أي إعلان لحفظه هنا.' : 'جرّب تغيير الفلاتر أو كلمة البحث.'}</span></div>`;
    $('#loadMoreWrap').hidden = true;
    return;
  }
  const slice = visibleJobs.slice(0, shownCount);
  $('#jobsGrid').innerHTML = slice.map((job) => `
    <article class="job-card">
      <div class="job-top"><span class="job-type ${job.type === 'حكومي' ? 'government' : 'private'}">${escapeHtml(job.type)}</span><button class="fav-btn ${isFav(job.id) ? 'on' : ''}" type="button" aria-label="حفظ" onclick="toggleFav('${escapeHtml(String(job.id))}')">${isFav(job.id) ? '♥' : '♡'}</button></div>
      <h3>${escapeHtml(job.title)}</h3>
      <p class="company">${escapeHtml(job.company)}</p>
      <div class="job-meta"><span>${escapeHtml(job.governorate)}</span><span>· ${escapeHtml(job.field)}</span></div>
      <p class="job-date">حتى ${formatDate(job.deadline)}</p>
      <p class="job-description">${escapeHtml(job.description)}</p>
      <div class="job-actions">
        <button class="btn btn-ghost" type="button" onclick="openJob('${escapeHtml(String(job.id))}')">التفاصيل</button>
        <button class="btn btn-whatsapp" type="button" onclick="shareJob('${escapeHtml(String(job.id))}')">واتساب</button>
      </div>
    </article>`).join('');
  $('#loadMoreWrap').hidden = visibleJobs.length <= shownCount;
}

function toggleFav(id) {
  const current = getFavs();
  const key = String(id);
  const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
  setFavs(next);
  renderJobs();
}

function jobUrl(id) {
  const url = new URL(window.location.href);
  url.hash = `job/${id}`;
  return url.toString();
}

function openJob(id) {
  const job = allJobs.find((item) => String(item.id) === String(id));
  if (!job) return;
  history.replaceState(null, '', `#job/${id}`);
  const contact = job.contact ? `<p><b>التواصل:</b> ${escapeHtml(job.contact)}</p>` : '';
  $('#jobPanelCard').innerHTML = `
    <div class="job-panel-head"><span class="job-type ${job.type === 'حكومي' ? 'government' : 'private'}">${escapeHtml(job.type)}</span><button class="close-panel" type="button" onclick="closeJob()" aria-label="إغلاق">×</button></div>
    <h2 id="jobPanelTitle">${escapeHtml(job.title)}</h2>
    <p class="company">${escapeHtml(job.company)}</p>
    <div class="job-panel-meta"><span>${escapeHtml(job.governorate)}</span><span>${escapeHtml(job.field)}</span><span>حتى ${formatDate(job.deadline)}</span></div>
    <div class="job-panel-body">${escapeHtml(job.description)}${contact}</div>
    <div class="job-panel-actions">
      <a class="btn btn-source" href="${escapeHtml(job.source)}" target="_blank" rel="noopener noreferrer">رابط المصدر</a>
      <button class="btn btn-whatsapp" type="button" onclick="shareJob('${escapeHtml(String(job.id))}')">مشاركة واتساب</button>
      <button class="btn btn-ghost" type="button" onclick="toggleFav('${escapeHtml(String(job.id))}'); openJob('${escapeHtml(String(job.id))}')">${isFav(job.id) ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}</button>
    </div>`;
  $('#jobPanel').hidden = false;
  document.body.style.overflow = 'hidden';
  setJobSchema(job);
}

function closeJob() {
  $('#jobPanel').hidden = true;
  document.body.style.overflow = '';
  if (location.hash.startsWith('#job/')) history.replaceState(null, '', '#jobs');
  const script = document.getElementById('jobSchema');
  if (script) script.remove();
}

function setJobSchema(job) {
  let script = document.getElementById('jobSchema');
  if (!script) { script = document.createElement('script'); script.type = 'application/ld+json'; script.id = 'jobSchema'; document.head.appendChild(script); }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting', title: job.title, description: job.description,
    datePosted: job.created_at || undefined, validThrough: job.deadline, employmentType: 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: job.company },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.governorate, addressCountry: 'SY' } },
    url: jobUrl(job.id)
  });
}

function openJobFromHash() {
  const match = location.hash.match(/^#job\/(.+)$/);
  if (match) openJob(decodeURIComponent(match[1]));
}

function shareJob(id) {
  const job = allJobs.find((item) => String(item.id) === String(id));
  if (!job) return;
  const text = `فرصة عمل عبر وظائف سوريا\n${job.title} - ${job.company}\nالمحافظة: ${job.governorate}\nآخر موعد: ${formatDate(job.deadline)}\n${jobUrl(job.id)}`;
  if (navigator.share) { navigator.share({ title: job.title, text, url: jobUrl(job.id) }).catch(() => {}); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

function showToast(message, type = 'success') {
  const toast = $('#toast'); toast.textContent = message; toast.className = `toast show ${type}`;
  window.setTimeout(() => { toast.className = 'toast'; }, 4500);
}

function fingerprint(data) {
  return `${data.title}|${data.company}|${data.deadline}`.toLowerCase().trim();
}

async function handlePublish(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());
  const recent = JSON.parse(sessionStorage.getItem(DUP_KEY) || '[]');
  const key = fingerprint(data);
  if (recent.includes(key)) { showToast('تم إرسال هذا الطلب مسبقًا في هذه الجلسة.', 'error'); return; }
  button.disabled = true; button.textContent = 'جارٍ الإرسال...';
  const payload = {
    title: data.title.trim(), company: data.company.trim(), governorate: data.governorate.trim(), field: data.field.trim(),
    type: data.type, deadline: data.deadline, source: data.source.trim(), description: data.description.trim(),
    contact: (data.contact || '').trim(), status: 'pending'
  };
  try {
    let { error } = await supabaseClient.from('job_submissions').insert(payload);
    if (error && /contact/i.test(error.message || '')) {
      delete payload.contact;
      payload.description = data.contact ? `${payload.description}\n\nالتواصل: ${data.contact.trim()}` : payload.description;
      ({ error } = await supabaseClient.from('job_submissions').insert(payload));
    }
    if (error) throw error;
    sessionStorage.setItem(DUP_KEY, JSON.stringify([...recent, key]));
    form.reset();
    showToast('تم حفظ طلبك بنجاح، وهو الآن قيد المراجعة.');
  } catch (error) {
    console.error('فشل حفظ طلب التوظيف:', error);
    showToast('تعذر حفظ الطلب. تأكد من إعداد جدول Supabase وسياسات RLS.', 'error');
  } finally { button.disabled = false; button.textContent = 'إرسال للمراجعة'; }
}

function submitHeroSearch(event) {
  event.preventDefault();
  $('#searchInput').value = $('#heroSearch').value;
  favOnly = false;
  applyFilters();
  document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
  return false;
}

function toggleMenu() { $('#mainNav').classList.toggle('open'); }
function showFavs() { favOnly = true; applyFilters(); document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' }); }

window.applyFilters = applyFilters;
window.shareJob = shareJob;
window.toggleMenu = toggleMenu;
window.toggleFav = toggleFav;
window.openJob = openJob;
window.closeJob = closeJob;
window.submitHeroSearch = submitHeroSearch;

document.addEventListener('DOMContentLoaded', () => {
  fillSelect($('#governorateFilter'), GOVERNORATES, 'كل المحافظات');
  fillSelect($('#fieldFilter'), FIELDS, 'كل المجالات');
  fillSelect($('#publishGovernorate'), GOVERNORATES, 'اختر المحافظة');
  fillSelect($('#publishField'), FIELDS, 'اختر المجال');
  const deadline = document.querySelector('input[name="deadline"]');
  if (deadline) deadline.min = new Date().toISOString().slice(0, 10);
  $('#publishForm').addEventListener('submit', handlePublish);
  $('#loadMoreBtn').addEventListener('click', () => { shownCount += PAGE_SIZE; renderJobs(); });
  $('#jobPanelBackdrop').addEventListener('click', closeJob);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeJob(); });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#favs') showFavs();
    else if (location.hash.startsWith('#job/')) openJobFromHash();
    else if (location.hash === '#jobs') { favOnly = false; applyFilters(); }
    $('#mainNav').classList.remove('open');
  });
  if (location.hash === '#favs') favOnly = true;
  loadJobs();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});

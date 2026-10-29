const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE = 'job_submissions';
const LOCAL_KEY = 'syria-jobs-submissions';
const GOVERNORATES = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'درعا', 'السويداء', 'القنيطرة', 'دير الزور', 'الحسكة', 'الرقة'];
const FIELDS = ['تقنية المعلومات', 'التعليم', 'الطب والرعاية الصحية', 'المحاسبة والمال', 'الهندسة', 'الإدارة', 'المبيعات والتسويق', 'القانون', 'الإعلام', 'الخدمات', 'النقل واللوجستيات', 'الصناعة', 'الزراعة', 'السياحة والضيافة', 'أخرى'];

let ads = [];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(d) {
  if (!d) return false;
  return new Date(`${d}T23:59:59`) < new Date();
}

function fillSelect(id, items, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  if (current) el.value = current;
}

function populateFilters() {
  const locs = [...new Set([...GOVERNORATES, ...ads.map((a) => a.governorate).filter(Boolean)])];
  const cats = [...new Set([...FIELDS, ...ads.map((a) => a.field).filter(Boolean)])];
  fillSelect('locationFilter', locs, 'كل المحافظات');
  fillSelect('categoryFilter', cats, 'كل المجالات');
}

function render() {
  const q = document.getElementById('searchInput').value.trim();
  const loc = document.getElementById('locationFilter').value;
  const cat = document.getElementById('categoryFilter').value;
  const type = document.getElementById('typeFilter').value;
  const filtered = ads.filter((a) => {
    if (isExpired(a.deadline)) return false;
    const haystack = `${a.title || ''} ${a.company || ''} ${a.description || ''}`;
    if (q && !haystack.includes(q)) return false;
    if (loc && a.governorate !== loc) return false;
    if (cat && a.field !== cat) return false;
    if (type && a.type !== type) return false;
    return true;
  });
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  document.getElementById('resultCount').textContent = `${filtered.length} إعلان`;
  document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';
  filtered.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <h4>${escapeHtml(a.title)}</h4>
      <div class="badges">
        ${a.type ? `<span class="badge gold">${escapeHtml(a.type)}</span>` : ''}
        ${a.governorate ? `<span class="badge">${escapeHtml(a.governorate)}</span>` : ''}
        ${a.field ? `<span class="badge">${escapeHtml(a.field)}</span>` : ''}
        ${a.deadline ? `<span class="badge deadline">آخر موعد: ${fmtDate(a.deadline)}</span>` : ''}
      </div>
      <p>${escapeHtml(a.description || '')}</p>
      <div class="card-foot">
        <span style="font-size:12.5px;color:var(--muted)">${escapeHtml(a.company || '')}</span>
        ${a.source ? `<a href="${escapeHtml(a.source)}" target="_blank" rel="noopener noreferrer">المصدر</a>` : '<span></span>'}
      </div>`;
    container.appendChild(el);
  });
}

async function loadAds() {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('خطأ في جلب الإعلانات:', error);
    document.getElementById('resultCount').textContent = 'تعذّر تحميل الإعلانات';
    return;
  }
  ads = data || [];
  populateFilters();
  render();
}

function openModal() { document.getElementById('modalBg').classList.add('open'); }
function closeModal() { document.getElementById('modalBg').classList.remove('open'); }

function normalizeSource(source) {
  const value = source.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function defaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function readLocalAds() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

function writeLocalAds(items) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function saveLocalAd(ad) {
  const items = readLocalAds();
  items.unshift(ad);
  writeLocalAds(items.slice(0, 200));
}

async function submitAd() {
  const title = document.getElementById('mTitle').value.trim();
  const company = document.getElementById('mCompany').value.trim();
  const governorate = document.getElementById('mLocation').value.trim();
  const field = document.getElementById('mField').value.trim() || 'أخرى';
  const type = document.getElementById('mType').value || 'خاص';
  const deadline = document.getElementById('mDeadline').value || defaultDeadline();
  const source = normalizeSource(document.getElementById('mSource').value);
  const description = document.getElementById('mBody').value.trim();
  const contact = document.getElementById('mContact').value.trim();
  const button = document.querySelector('#modalBg .btn-primary');

  if (!title || !company || !governorate || !description || !source) {
    alert('يرجى تعبئة المسمى، الجهة، المحافظة، التفاصيل، ورابط المصدر.');
    return;
  }
  if (title.length < 2 || company.length < 2 || description.length < 10) {
    alert('تحقق من طول الحقول: المسمى والجهة حرفان على الأقل، والتفاصيل 10 أحرف على الأقل.');
    return;
  }
  if (!/^https?:\/\//i.test(source)) {
    alert('رابط المصدر يجب أن يبدأ بـ http:// أو https://');
    return;
  }

  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    company,
    governorate,
    field,
    type,
    deadline,
    source,
    description: contact ? `${description}\nللتواصل: ${contact}` : description,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  button.disabled = true;
  try {
    const { error } = await supabaseClient.from(TABLE).insert([{
      title: payload.title,
      company: payload.company,
      governorate: payload.governorate,
      field: payload.field,
      type: payload.type,
      deadline: payload.deadline,
      source: payload.source,
      description: payload.description,
      status: 'pending'
    }]);
    saveLocalAd(payload);
    if (error) console.error('تعذر الحفظ في قاعدة البيانات، حُفظ محليًا:', error);
    alert('تم استلام طلبك، سيُنشر بعد المراجعة.');
    ['mTitle', 'mCompany', 'mLocation', 'mField', 'mSource', 'mBody', 'mContact'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('mType').value = 'خاص';
    document.getElementById('mDeadline').value = defaultDeadline();
    closeModal();
  } finally {
    button.disabled = false;
  }
}

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('locationFilter').addEventListener('change', render);
document.getElementById('categoryFilter').addEventListener('change', render);
document.getElementById('typeFilter').addEventListener('change', render);

fillSelect('mLocation', GOVERNORATES, 'المحافظة');
fillSelect('mField', FIELDS, 'المجال');
const deadlineInput = document.getElementById('mDeadline');
deadlineInput.min = new Date().toISOString().slice(0, 10);
deadlineInput.value = defaultDeadline();
populateFilters();
loadAds();

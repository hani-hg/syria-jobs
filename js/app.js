const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE = 'job_submissions';
const GOVERNORATES = ['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','درعا','السويداء','القنيطرة','دير الزور','الحسكة','الرقة'];
const FIELDS = ['تقنية المعلومات','التعليم','الطب والرعاية الصحية','المحاسبة والمال','الهندسة','الإدارة','المبيعات والتسويق','القانون','الإعلام','الخدمات','النقل واللوجستيات','الصناعة','الزراعة','السياحة والضيافة','أخرى'];
const SECTION = {gov:{title:'وظائف حكومية', eyebrow:'فرص القطاع العام', listingType:'job', sector:'حكومي'},private:{title:'وظائف قطاع خاص',eyebrow:'فرص الشركات والجهات',listingType:'job',sector:'خاص'},seeker:{title:'مطلوب وظيفة',eyebrow:'باحثون عن فرصة',listingType:'seeker'}};
let ads = [];
let activeSection = 'gov';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localISODate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return localISODate(date); };
const norm = (text) => String(text || '').toLocaleLowerCase('ar').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').trim();
function fillSelect(el, items, placeholder) {
  const selected = el.value;
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  if (items.includes(selected)) el.value = selected;
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0,10)}T12:00:00`);
  return new Intl.DateTimeFormat('ar-SY', {day:'numeric',month:'short',year:'numeric'}).format(date);
}
function isExpired(value) { return Boolean(value && String(value).slice(0,10) < localISODate()); }
function getSectionAds() {
  const conf = SECTION[activeSection];
  return ads.filter((ad) => {
    if (isExpired(ad.deadline)) return false;
    if (conf.listingType === 'seeker') return ad.listing_type === 'seeker';
    return ad.listing_type !== 'seeker' && ad.type === conf.sector;
  });
}
function render() {
  const query = norm($('searchInput').value);
  const location = $('locationFilter').value;
  const field = $('categoryFilter').value;
  const filtered = getSectionAds().filter((ad) => {
    const text = norm([ad.title,ad.company,ad.description,ad.experience,ad.work_arrangement,ad.field].join(' '));
    return (!query || text.includes(query)) && (!location || ad.governorate === location) && (!field || ad.field === field);
  });
  $('cardsContainer').innerHTML = filtered.map(renderCard).join('');
  $('resultCount').textContent = `${filtered.length} إعلان`;
  $('emptyState').hidden = filtered.length > 0;
  $('sectionTitle').textContent = SECTION[activeSection].title;
  $('sectionEyebrow').textContent = SECTION[activeSection].eyebrow;
}
function renderCard(ad) {
  const seeker = ad.listing_type === 'seeker';
  const source = ad.source && /^https?:\/\//i.test(ad.source) ? `<a href="${escapeHtml(ad.source)}" target="_blank" rel="noopener noreferrer">${seeker ? 'المصدر' : 'عرض الإعلان الأصلي'} ↗</a>` : '';
  const contact = ad.contact ? `<span>للتواصل: ${escapeHtml(ad.contact)}</span>` : '<span>التواصل عبر الجهة المعلنة</span>';
  const badges = [ad.governorate,ad.field,seeker ? ad.experience : (ad.type === 'حكومي' ? 'القطاع الحكومي' : 'القطاع الخاص'),ad.work_arrangement].filter(Boolean);
  const expiredLabel = seeker ? `متاح حتى ${formatDate(ad.deadline)}` : `آخر موعد ${formatDate(ad.deadline)}`;
  return `<article class="card ${seeker ? 'seeker' : ''}"><div class="card-top"><span class="listing-badge">${seeker ? 'مطلوب وظيفة' : escapeHtml(ad.type === 'حكومي' ? 'وظيفة حكومية' : 'وظيفة قطاع خاص')}</span><time class="date-label">${escapeHtml(expiredLabel)}</time></div><h3>${escapeHtml(ad.title)}</h3><p class="card-org">${escapeHtml(seeker ? 'باحث عن عمل' : (ad.company || 'جهة معلنة'))}</p><div class="badges">${badges.map((badge) => `<span class="badge ${badge === 'القطاع الحكومي' ? 'gold' : ''}">${escapeHtml(badge)}</span>`).join('')}</div><p class="card-description">${escapeHtml(ad.description || '')}</p><div class="card-meta">${contact}${source}</div></article>`;
}
async function loadAds() {
  const today = localISODate();
  const {data,error} = await db.from(TABLE).select('*').eq('status','approved').gte('deadline',today).order('created_at',{ascending:false});
  if (error) {
    console.error('تعذر تحميل الإعلانات:', error);
    $('resultCount').textContent = 'تعذّر تحميل الإعلانات';
    $('emptyState').hidden = false;
    $('emptyState').querySelector('h3').textContent = 'يتطلب تحديث قاعدة البيانات';
    $('emptyState').querySelector('p').textContent = 'يحتاج الموقع إلى تطبيق ملف supabase/migration-listing-types.sql لتمكين الأقسام الجديدة.';
    return;
  }
  ads = data || [];
  const locations = [...new Set([...GOVERNORATES,...ads.map((a)=>a.governorate).filter(Boolean)])];
  const fields = [...new Set([...FIELDS,...ads.map((a)=>a.field).filter(Boolean)])];
  fillSelect($('locationFilter'),locations,'كل المحافظات');
  fillSelect($('categoryFilter'),fields,'كل المجالات');
  render();
}
function setSection(name) {
  activeSection = name;
  document.querySelectorAll('.section-tab').forEach((button) => {
    const active = button.dataset.section === name;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  render();
}
function setFormType() {
  const seeker = $('listingType').value === 'seeker';
  $('jobFields').hidden = seeker;
  $('seekerFields').hidden = !seeker;
  $('company').required = !seeker;
  $('source').required = !seeker;
  $('jobDeadline').required = !seeker;
  $('jobSector').disabled = seeker;
  $('company').disabled = seeker;
  $('source').disabled = seeker;
  $('jobDeadline').disabled = seeker;
  $('experience').disabled = !seeker;
  $('workArrangement').disabled = !seeker;
  $('jobDeadline').min = localISODate();
  $('jobDeadline').value = $('jobDeadline').value || addDays(30);
  $('formTitle').textContent = seeker ? 'أعلن أنك تبحث عن عمل' : 'أضف وظيفة شاغرة';
  $('contactConsent').textContent = seeker ? 'إذا أضفت وسيلة تواصل فستظهر للعامة بعد اعتماد طلبك. اتركه فارغًا إن لم ترغب بمشاركة وسيلة مباشرة.' : 'إذا أضفت وسيلة تواصل فستظهر للزوار بعد اعتماد الإعلان.';
}
function openModal() {
  $('listingType').value = activeSection === 'seeker' ? 'seeker' : 'job';
  $('jobSector').value = activeSection === 'private' ? 'خاص' : 'حكومي';
  $('formMessage').textContent = '';
  $('modalBg').hidden = false;
  document.body.style.overflow = 'hidden';
  setFormType();
  setTimeout(() => $('listingType').focus(),50);
}
function closeModal() { $('modalBg').hidden = true; document.body.style.overflow = ''; }
async function submitAd(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const seeker = $('listingType').value === 'seeker';
  const payload = {
    listing_type: seeker ? 'seeker' : 'job',
    title: $('title').value.trim(),
    company: seeker ? 'باحث عن عمل' : $('company').value.trim(),
    governorate: $('governorate').value,
    field: $('field').value,
    type: seeker ? 'خاص' : $('jobSector').value,
    deadline: seeker ? addDays(60) : $('jobDeadline').value,
    source: seeker ? null : $('source').value.trim(),
    description: $('description').value.trim(),
    contact: $('contact').value.trim() || null,
    experience: seeker ? ($('experience').value.trim() || null) : null,
    work_arrangement: seeker ? ($('workArrangement').value || null) : null,
    status: 'pending'
  };
  const button = $('submitButton');
  const message = $('formMessage');
  button.disabled = true;
  button.textContent = 'جارٍ الإرسال…';
  message.className = 'form-message';
  message.textContent = '';
  try {
    const {error} = await db.from(TABLE).insert(payload);
    if (error) throw error;
    message.textContent = 'وصل إعلانك للمراجعة. لن يظهر للزوار حتى تتم الموافقة عليه.';
    $('adForm').reset();
    fillSelect($('governorate'),GOVERNORATES,'اختر المحافظة');
    fillSelect($('field'),FIELDS,'اختر المجال');
    setTimeout(closeModal,1800);
  } catch (error) {
    console.error('فشل إرسال الإعلان:',error);
    message.className = 'form-message error';
    message.textContent = error.code === '42703' || /column .* does not exist/i.test(error.message || '')
      ? 'قاعدة البيانات لم تُحدّث بعد. طبّق ملف migration-listing-types.sql ثم أعد الإرسال.'
      : 'لم نتمكن من إرسال الإعلان الآن. تحقق من الاتصال وحاول مجددًا.';
  } finally {
    button.disabled = false;
    button.textContent = 'إرسال للمراجعة';
    setFormType();
  }
}
document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click',()=>setSection(button.dataset.section)));
document.querySelectorAll('[data-open-form]').forEach((button) => button.addEventListener('click',openModal));
$('closeModal').addEventListener('click',closeModal);
$('cancelModal').addEventListener('click',closeModal);
$('modalBg').addEventListener('click',(event)=>{if(event.target === $('modalBg')) closeModal();});
document.addEventListener('keydown',(event)=>{if(event.key === 'Escape' && !$('modalBg').hidden) closeModal();});
$('listingType').addEventListener('change',setFormType);
$('adForm').addEventListener('submit',submitAd);
$('searchInput').addEventListener('input',render);
$('locationFilter').addEventListener('change',render);
$('categoryFilter').addEventListener('change',render);
$('resetFilters').addEventListener('click',()=>{$('searchInput').value='';$('locationFilter').value='';$('categoryFilter').value='';render();});
fillSelect($('governorate'),GOVERNORATES,'اختر المحافظة');
fillSelect($('field'),FIELDS,'اختر المجال');
setFormType();
loadAds();

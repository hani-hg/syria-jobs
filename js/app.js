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
function safeHttpUrl(value) {
  try { const url = new URL(String(value || '')); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }
  catch (_) { return ''; }
}
function safeMailto(value) {
  const match = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(String(value || '').trim());
  return match ? `mailto:${encodeURIComponent(match[1])}@${encodeURIComponent(match[2])}` : '';
}
function normalizeWhatsapp(value) {
  const digitMap = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  let number = String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit]).replace(/\D/g, '');
  if (number.startsWith('00')) number = number.slice(2);
  if (number.startsWith('0')) number = `963${number.slice(1)}`;
  else if (number.length === 9 && number.startsWith('9')) number = `963${number}`;
  return number.length >= 8 && number.length <= 15 ? number : '';
}
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
function formatCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) ? count.toLocaleString('ar-SY') : '0';
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
  const sectionAds = getSectionAds();
  const filtered = sectionAds.filter((ad) => {
    const text = norm([ad.title,ad.company,ad.description,ad.experience,ad.work_arrangement,ad.field].join(' '));
    return (!query || text.includes(query)) && (!location || ad.governorate === location) && (!field || ad.field === field);
  });
  $('cardsContainer').innerHTML = filtered.map(renderCard).join('');
  $('resultCount').textContent = filtered.length + ' إعلان';
  $('emptyState').hidden = filtered.length > 0;
  $('retryLoad').hidden = true;
  if (!filtered.length) {
    const hasFilters = Boolean(query || location || field);
    $('emptyState').querySelector('h3').textContent = hasFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد إعلانات في هذا القسم الآن';
    $('emptyState').querySelector('p').textContent = hasFilters
      ? 'جرّب تغيير كلمات البحث أو المحافظة أو المجال.'
      : 'يمكنك العودة لاحقًا للإعلانات الجديدة أو إضافة إعلان للمراجعة.';
  }
  $('sectionTitle').textContent = SECTION[activeSection].title;
  $('sectionEyebrow').textContent = SECTION[activeSection].eyebrow;
}
function renderCard(ad) {
  const seeker = ad.listing_type === 'seeker';
  const sourceUrl = safeHttpUrl(ad.source);
  const source = sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${seeker ? 'المصدر' : 'عرض الإعلان الأصلي'} ↗</a>` : '';
  const contact = ad.contact ? `<span>للتواصل: ${escapeHtml(ad.contact)}</span>` : (seeker ? '<span>وسيلة التواصل غير منشورة</span>' : '<span>التواصل عبر الجهة المعلنة</span>');
  const badges = [ad.governorate,ad.field,seeker ? ad.experience : (ad.type === 'حكومي' ? 'القطاع الحكومي' : 'القطاع الخاص'),ad.work_arrangement].filter(Boolean);
  const expiredLabel = seeker ? `متاح حتى ${formatDate(ad.deadline)}` : `آخر موعد ${formatDate(ad.deadline)}`;
  const description = String(ad.description || '');
  const hasMore = description.length > 170;
  const preview = hasMore ? `${description.slice(0, 170).trimEnd()}…` : description;
  return `<article class="card ${seeker ? 'seeker' : ''}"><div class="card-top"><span class="listing-badge">${seeker ? 'مطلوب وظيفة' : escapeHtml(ad.type === 'حكومي' ? 'وظيفة حكومية' : 'وظيفة قطاع خاص')}</span><time class="date-label">${escapeHtml(expiredLabel)}</time></div><h3>${escapeHtml(ad.title)}</h3><p class="card-org">${escapeHtml(seeker ? 'باحث عن عمل' : (ad.company || 'جهة معلنة'))}</p><div class="badges">${badges.map((badge) => `<span class="badge ${badge === 'القطاع الحكومي' ? 'gold' : ''}">${escapeHtml(badge)}</span>`).join('')}</div><p class="card-description">${escapeHtml(preview)}</p><button class="card-more" type="button" data-action="details" data-id="${escapeHtml(ad.id)}" aria-haspopup="dialog">${hasMore ? 'اقرأ المزيد' : 'تفاصيل الإعلان'}</button><div class="card-actions"><button class="btn btn-smart-apply" type="button" data-action="smart-apply" data-id="${escapeHtml(ad.id)}" aria-haspopup="dialog">قدّم الآن</button></div><div class="card-meta">${contact}<span class="card-views" data-view-id="${escapeHtml(ad.id)}">المشاهدات: ${formatCount(ad.view_count)}</span>${source}</div></article>`;
}
function showListingLoadError(error) {
  console.error('تعذر تحميل الإعلانات:', error && (error.code || error.name || 'خطأ اتصال'));
  $('resultCount').textContent = 'تعذر التحميل';
  $('emptyState').hidden = false;
  $('emptyState').querySelector('h3').textContent = 'لم نتمكن من تحميل الإعلانات';
  $('emptyState').querySelector('p').textContent = 'تحقق من اتصالك وحاول مرة أخرى.';
  $('retryLoad').hidden = false;
}
async function loadAds() {
  $('resultCount').textContent = 'جارٍ تحميل الإعلانات…';
  $('emptyState').hidden = true;
  $('retryLoad').hidden = true;
  try {
    let result = await db.rpc('list_public_jobs');
    if (result.error && ['PGRST202','42883'].includes(result.error.code)) {
      result = await db.from(TABLE)
        .select('id,listing_type,title,company,governorate,field,type,deadline,source,description,experience,work_arrangement,view_count,created_at')
        .eq('status','approved')
        .gte('deadline',localISODate())
        .order('created_at',{ascending:false});
    }
    if (result.error) throw result.error;
    ads = result.data || [];
    const locations = [...new Set([...GOVERNORATES,...ads.map((a)=>a.governorate).filter(Boolean)])];
    const fields = [...new Set([...FIELDS,...ads.map((a)=>a.field).filter(Boolean)])];
    fillSelect($('locationFilter'),locations,'كل المحافظات');
    fillSelect($('categoryFilter'),fields,'كل المجالات');
    render();
  } catch (error) {
    showListingLoadError(error);
  }
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
  $('source').required = false;
  $('jobDeadline').required = !seeker;
  $('jobSector').disabled = seeker;
  $('company').disabled = seeker;
  $('source').disabled = seeker;
  $('jobDeadline').disabled = seeker;
  $('contactWhatsapp').disabled = seeker;
  $('contactWhatsapp').required = false;
  if (seeker) $('contactWhatsapp').value = '';
  $('experience').disabled = !seeker;
  $('workArrangement').disabled = !seeker;
  $('jobDeadline').min = localISODate();
  $('jobDeadline').value = $('jobDeadline').value || addDays(30);
  $('formTitle').textContent = seeker ? 'أعلن أنك تبحث عن عمل' : 'أضف وظيفة شاغرة';
  $('contactConsent').textContent = 'لن يظهر الهاتف أو واتساب أو البريد للزوار إلا إذا وافقت هنا واعتمد الإعلان.';
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
function isMissingSmartApplyColumn(error) {
  return ['PGRST204','42703'].includes(error && error.code) && /contact_(public|whatsapp|email)/i.test(String(error && error.message || ''));
}
async function insertPendingAd(payload) {
  const result = await db.from(TABLE).insert(payload);
  if (!result.error) return;
  if (!isMissingSmartApplyColumn(result.error)) throw result.error;
  if (payload.contact || payload.contact_whatsapp || payload.contact_email) {
    const error = new Error('SMART_APPLY_MIGRATION_REQUIRED');
    error.code = 'SMART_APPLY_MIGRATION_REQUIRED';
    throw error;
  }
  const {contact_public,contact_whatsapp,contact_email,...legacyPayload} = payload;
  const fallback = await db.from(TABLE).insert(legacyPayload);
  if (fallback.error) throw fallback.error;
}
async function submitAd(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('formMessage');
  message.className = 'form-message';
  message.textContent = '';
  if (!form.reportValidity()) return;
  const seeker = $('listingType').value === 'seeker';
  const contactValue = $('contact').value.trim();
  const whatsappValue = $('contactWhatsapp').value.trim();
  const emailValue = $('contactEmail').value.trim();
  const contactPublic = $('contactPublic').checked;
  const hasAnyContact = Boolean(contactValue || (!seeker && whatsappValue) || emailValue);
  if (hasAnyContact && !contactPublic) {
    message.className = 'form-message error';
    message.textContent = 'فعّل الموافقة إذا أردت إظهار الهاتف أو واتساب أو البريد، أو اترك حقول التواصل فارغة.';
    $('contactPublic').focus();
    return;
  }
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
    contact: contactPublic ? (contactValue || null) : null,
    contact_whatsapp: !seeker && contactPublic ? (whatsappValue || null) : null,
    contact_email: contactPublic ? (emailValue || null) : null,
    contact_public: Boolean(hasAnyContact && contactPublic),
    experience: seeker ? ($('experience').value.trim() || null) : null,
    work_arrangement: seeker ? ($('workArrangement').value || null) : null,
    status: 'pending'
  };
  const button = $('submitButton');
  button.disabled = true;
  button.textContent = 'جارٍ الإرسال…';
  try {
    await insertPendingAd(payload);
    message.textContent = 'وصل إعلانك للمراجعة. لن يظهر للزوار حتى تتم الموافقة عليه.';
    $('adForm').reset();
    fillSelect($('governorate'),GOVERNORATES,'اختر المحافظة');
    fillSelect($('field'),FIELDS,'اختر المجال');
    setTimeout(closeModal,1800);
  } catch (error) {
    console.error('فشل إرسال الإعلان:', error && (error.code || error.name || 'خطأ اتصال'));
    message.className = 'form-message error';
    message.textContent = error && error.code === 'SMART_APPLY_MIGRATION_REQUIRED'
      ? 'قاعدة البيانات تحتاج إلى تحديث ميزة التقديم الذكي؛ أرسل الإعلان دون وسائل تواصل أو حاول لاحقًا.'
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
$('retryLoad').addEventListener('click',loadAds);
loadAds();

function openDetails(id) {
  const ad = ads.find((item) => String(item.id) === String(id));
  if (!ad) return;
  const viewKey = `syria-jobs-viewed:${ad.id}`;
  let shouldCount = true;
  try {
    shouldCount = sessionStorage.getItem(viewKey) !== '1';
    if (shouldCount) sessionStorage.setItem(viewKey, '1');
  } catch (_) {}
  const seeker = ad.listing_type === 'seeker';
  $('detailsTitle').textContent = ad.title || 'تفاصيل الإعلان';
  $('detailsMeta').textContent = [seeker ? 'مطلوب وظيفة' : (ad.type === 'حكومي' ? 'وظيفة حكومية' : 'وظيفة قطاع خاص'), ad.company, ad.governorate, ad.field].filter(Boolean).join(' · ');
  $('detailsViews').textContent = `المشاهدات: ${formatCount(ad.view_count)}`;
  $('detailsDescription').textContent = ad.description || '';
  const source = $('detailsSource');
  if (ad.source && /^https?:\/\//i.test(ad.source)) {
    source.href = ad.source;
    source.hidden = false;
  } else {
    source.hidden = true;
    source.removeAttribute('href');
  }
  $('detailsModalBg').hidden = false;
  document.body.style.overflow = 'hidden';
  $('closeDetails').focus();
  if (shouldCount) incrementListingView(ad, viewKey);
}
async function incrementListingView(ad, viewKey) {
  try {
    const {data,error} = await db.rpc('increment_listing_view', {p_listing_id: ad.id});
    if (error) throw error;
    ad.view_count = Number(data) || (Number(ad.view_count) || 0) + 1;
    const label = `المشاهدات: ${formatCount(ad.view_count)}`;
    $('detailsViews').textContent = label;
    document.querySelectorAll('.card-views').forEach((element) => {
      if (element.dataset.viewId === String(ad.id)) element.textContent = label;
    });
  } catch (error) {
    try { sessionStorage.removeItem(viewKey); } catch (_) {}
    console.warn('تعذر تحديث عداد مشاهدات الإعلان. تحقق من تطبيق ترحيل قاعدة البيانات.', error.message || error);
  }
}
function closeDetails() {
  $('detailsModalBg').hidden = true;
  document.body.style.overflow = '';
}
function setSmartAction(id, href) {
  const link = $(id);
  link.hidden = !href;
  if (href) link.href = href;
  else link.removeAttribute('href');
}
function openSmartApply(id) {
  const ad = ads.find((item) => String(item.id) === String(id));
  if (!ad) return;
  const title = String(ad.title || 'الوظيفة');
  const whatsapp = normalizeWhatsapp(ad.contact_whatsapp);
  const whatsappMessage = `مرحباً، أتيت من منصة وظائف سوريا، أرغب بالتقديم على وظيفة ${title}`;
  const source = safeHttpUrl(ad.source);
  const email = String(ad.contact_email || '').trim();
  const emailAddress = safeMailto(email);
  const emailBody = `مرحباً، أتيت من منصة وظائف سوريا، أرغب بالتقديم على وظيفة ${title}`;
  setSmartAction('smartWhatsApp', whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(whatsappMessage)}` : '');
  setSmartAction('smartSource', source);
  setSmartAction('smartEmail', emailAddress ? `${emailAddress}?subject=${encodeURIComponent(`التقديم على وظيفة: ${title}`)}&body=${encodeURIComponent(emailBody)}` : '');
  const hasRoute = Boolean(whatsapp || source || emailAddress);
  $('smartApplyTitle').textContent = title;
  $('smartApplyIntro').textContent = hasRoute ? 'اختر وسيلة التقديم المتاحة في الإعلان.' : 'لم يضف صاحب الإعلان وسيلة تقديم مباشرة.';
  $('smartApplyFallback').hidden = hasRoute;
  $('smartApplyFallback').textContent = source ? 'راجع تفاصيل الإعلان في المصدر.' : 'لا توجد وسيلة تقديم مباشرة. راجع تفاصيل الإعلان أو الموقع الرسمي للجهة المعلنة.';
  $('smartApplyModalBg').hidden = false;
  document.body.style.overflow = 'hidden';
  $('closeSmartApply').focus();
}
function closeSmartApply() {
  $('smartApplyModalBg').hidden = true;
  document.body.style.overflow = '';
}
$('cardsContainer').addEventListener('click', (event) => {
  const applyButton = event.target.closest('button[data-action="smart-apply"]');
  if (applyButton) { openSmartApply(applyButton.dataset.id); return; }
  const detailsButton = event.target.closest('button[data-action="details"]');
  if (detailsButton) openDetails(detailsButton.dataset.id);
});
$('closeDetails').addEventListener('click', closeDetails);
$('detailsModalBg').addEventListener('click', (event) => { if (event.target === $('detailsModalBg')) closeDetails(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('detailsModalBg').hidden) closeDetails(); });
$('closeSmartApply').addEventListener('click', closeSmartApply);
$('smartApplyModalBg').addEventListener('click', (event) => { if (event.target === $('smartApplyModalBg')) closeSmartApply(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('smartApplyModalBg').hidden) closeSmartApply(); });

function openContactModal() {
  $('contactForm').reset();
  $('contactMessageStatus').textContent = '';
  $('contactMessageStatus').className = 'form-message';
  $('contactModalBg').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('contactName').focus(), 50);
}
function closeContactModal() {
  $('contactModalBg').hidden = true;
  document.body.style.overflow = '';
}
async function submitContactMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = $('sendContact');
  const status = $('contactMessageStatus');
  button.disabled = true;
  button.textContent = 'جارٍ الإرسال…';
  status.textContent = '';
  status.className = 'form-message';
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'تعذر إرسال الرسالة.');
    status.textContent = 'وصلت رسالتك بنجاح. شكرًا لتواصلك معنا.';
    form.reset();
    setTimeout(closeContactModal, 1800);
  } catch (error) {
    status.className = 'form-message error';
    status.textContent = error.message || 'تعذر إرسال الرسالة الآن. حاول مجددًا.';
  } finally {
    button.disabled = false;
    button.textContent = 'إرسال الرسالة';
  }
}
$('openContact').addEventListener('click', openContactModal);
$('closeContact').addEventListener('click', closeContactModal);
$('cancelContact').addEventListener('click', closeContactModal);
$('contactModalBg').addEventListener('click', (event) => { if (event.target === $('contactModalBg')) closeContactModal(); });
$('contactForm').addEventListener('submit', submitContactMessage);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('contactModalBg').hidden) closeContactModal(); });
if (new URLSearchParams(window.location.search).get('contact') === '1') openContactModal();

// OneSignal Web Push: request permission only after an explicit user click.
const enableNotificationsButton = $('enableNotifications');
const notificationStatus = $('notificationStatus');
let oneSignalClient = null;
let oneSignalIsReady = false;

function setNotificationMessage(message, state = '') {
  if (!notificationStatus) return;
  notificationStatus.textContent = message;
  notificationStatus.className = `notification-status${state ? ` ${state}` : ''}`;
}

function markNotificationsEnabled() {
  if (!enableNotificationsButton) return;
  enableNotificationsButton.disabled = true;
  enableNotificationsButton.textContent = 'الإشعارات مفعّلة';
  setNotificationMessage('تم تفعيل الإشعارات بنجاح لهذا المتصفح.');
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalledPwa() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function waitForPushSubscription(OneSignal, timeoutMs = 10000) {
  const subscription = OneSignal.User.PushSubscription;
  if (subscription.optedIn) return Promise.resolve(true);

  return new Promise((resolve) => {
    let timeoutId;
    let finished = false;
    const finish = (subscribed) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      subscription.removeEventListener('change', onChange);
      resolve(subscribed);
    };
    const onChange = (event) => {
      if (event?.current?.optedIn) finish(true);
    };

    subscription.addEventListener('change', onChange);
    timeoutId = setTimeout(() => finish(Boolean(subscription.optedIn)), timeoutMs);
    if (subscription.optedIn) finish(true);
  });
}

if (enableNotificationsButton && notificationStatus) {
  enableNotificationsButton.disabled = true;
  setNotificationMessage('جارٍ تهيئة خدمة الإشعارات…');

  window.addEventListener('syria-onesignal-ready', (event) => {
    oneSignalClient = event.detail;
    oneSignalIsReady = Boolean(oneSignalClient);
    if (!oneSignalIsReady) return;

    if (isAppleMobileDevice() && !isInstalledPwa()) {
      setNotificationMessage('على iPhone أو iPad، أضف الموقع إلى الشاشة الرئيسية وافتحه منها (iOS 16.4 أو أحدث).');
      return;
    }

    if (!oneSignalClient.Notifications.isPushSupported()) {
      setNotificationMessage('هذا المتصفح أو وضع التصفح الحالي لا يدعم إشعارات الويب.');
      return;
    }

    const pushSubscription = oneSignalClient.User.PushSubscription;
    pushSubscription.addEventListener('change', (change) => {
      if (change?.current?.optedIn) markNotificationsEnabled();
      else if (!pushSubscription.optedIn) {
        enableNotificationsButton.disabled = false;
        enableNotificationsButton.textContent = 'تفعيل الإشعارات';
      }
    });

    if (pushSubscription.optedIn) markNotificationsEnabled();
    else {
      enableNotificationsButton.disabled = false;
      setNotificationMessage('');
    }
  }, { once: true });

  window.addEventListener('syria-onesignal-error', () => {
    setNotificationMessage('تعذرت تهيئة OneSignal. تحقّق من App ID ورابط الموقع في إعدادات OneSignal.', 'error');
  }, { once: true });

  setTimeout(() => {
    if (!oneSignalIsReady && window.OneSignalInitState !== 'error') {
      setNotificationMessage('لم تكتمل تهيئة خدمة الإشعارات. تحقّق من الاتصال ثم حدّث الصفحة.', 'error');
    }
  }, 15000);

  enableNotificationsButton.addEventListener('click', async () => {
    if (!oneSignalIsReady || !oneSignalClient) {
      setNotificationMessage('خدمة الإشعارات لم تجهز بعد. حدّث الصفحة وحاول مجددًا.', 'error');
      return;
    }

    if (!oneSignalClient.Notifications.isPushSupported()) {
      setNotificationMessage('هذا المتصفح أو وضع التصفح الحالي لا يدعم إشعارات الويب.', 'error');
      return;
    }

    if ('Notification' in window && Notification.permission === 'denied') {
      setNotificationMessage('إشعارات الموقع محظورة في المتصفح. اسمح بها من إعدادات الموقع ثم أعد المحاولة.', 'error');
      return;
    }

    enableNotificationsButton.disabled = true;
    enableNotificationsButton.textContent = 'جارٍ التفعيل…';
    setNotificationMessage('سيطلب المتصفح إذن الإشعارات الآن.');
    try {
      await oneSignalClient.Notifications.requestPermission();
      if (!oneSignalClient.Notifications.permission) {
        setNotificationMessage('لم يتم منح الإذن. يمكنك السماح لاحقًا من إعدادات الموقع في المتصفح.', 'error');
        return;
      }

      await oneSignalClient.User.PushSubscription.optIn();
      if (await waitForPushSubscription(oneSignalClient)) {
        markNotificationsEnabled();
      } else {
        setNotificationMessage('تم السماح بالإشعارات، لكن لم يكتمل الاشتراك بعد. تحقق من إعدادات المتصفح وحاول مجددًا.', 'error');
      }
    } catch (error) {
      console.warn('OneSignal subscription could not be completed.', error);
      setNotificationMessage('تعذر تفعيل الإشعارات الآن. تحقق من اتصالك وإعدادات الموقع ثم حاول مجددًا.', 'error');
    } finally {
      if (!oneSignalClient.User.PushSubscription.optedIn) {
        enableNotificationsButton.disabled = false;
        enableNotificationsButton.textContent = 'تفعيل الإشعارات';
      }
    }
  });
}

// Homepage banner slider: reads up to three public images from Supabase.
const BANNER_TABLE = 'homepage_banners';
const BANNER_INTERVAL_MS = 7000;
let bannerSlides = [];
let bannerIndex = 0;
let bannerTimer = null;
function renderBanner() {
  const track = $('bannerTrack');
  const dots = $('bannerDots');
  if (!track || !dots) return;
  const slider = $('bannerSlider');
  if (!bannerSlides.length) {
    track.innerHTML = '<div class="banner-placeholder"><span>وظائف سوريا</span><strong>فرص العمل في سوريا،<br>بمكان واحد.</strong><small>وظائف حكومية وخاصة، ومساحة للباحثين عن عمل</small></div>';
    dots.innerHTML = '';
    $('bannerPrev').hidden = true;
    $('bannerNext').hidden = true;
    slider.classList.add('banner-empty');
    stopBannerRotation();
    return;
  }
  slider.classList.remove('banner-empty');
  track.innerHTML = bannerSlides.map((slide, index) => `<div class="banner-slide${index === bannerIndex ? ' active' : ''}" aria-hidden="${index !== bannerIndex}"><img src="${escapeHtml(slide.image_url)}" alt="${escapeHtml(slide.alt_text || `صورة مميزة ${index + 1}`)}" ${index === bannerIndex ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`).join('');
  dots.innerHTML = bannerSlides.map((slide, index) => `<button type="button" class="banner-dot${index === bannerIndex ? ' active' : ''}" data-banner-index="${index}" aria-label="عرض الصورة ${index + 1}" aria-current="${index === bannerIndex ? 'true' : 'false'}"></button>`).join('');
  $('bannerPrev').hidden = bannerSlides.length < 2;
  $('bannerNext').hidden = bannerSlides.length < 2;
  dots.hidden = bannerSlides.length < 2;
  startBannerRotation();
}
async function loadBannerSlides() {
  const { data, error } = await db.from(BANNER_TABLE).select('slot,image_url,alt_text').order('slot', { ascending: true }).limit(3);
  if (error) {
    console.warn('تعذر تحميل صور البانر؛ ستظهر المساحة الافتراضية.', error.message);
    return;
  }
  bannerSlides = (data || []).filter((item) => {
    try { return new URL(item.image_url).protocol === 'https:'; } catch { return false; }
  });
  bannerIndex = 0;
  renderBanner();
}
function goToBanner(index) {
  if (!bannerSlides.length) return;
  bannerIndex = (index + bannerSlides.length) % bannerSlides.length;
  renderBanner();
}
function stopBannerRotation() {
  if (bannerTimer) clearInterval(bannerTimer);
  bannerTimer = null;
}
function startBannerRotation() {
  stopBannerRotation();
  if (bannerSlides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  bannerTimer = setInterval(() => { bannerIndex = (bannerIndex + 1) % bannerSlides.length; renderBanner(); }, BANNER_INTERVAL_MS);
}
$('bannerPrev').addEventListener('click', () => goToBanner(bannerIndex - 1));
$('bannerNext').addEventListener('click', () => goToBanner(bannerIndex + 1));
$('bannerDots').addEventListener('click', (event) => {
  const button = event.target.closest('[data-banner-index]');
  if (button) goToBanner(Number(button.dataset.bannerIndex));
});
$('bannerSlider').addEventListener('mouseenter', stopBannerRotation);
$('bannerSlider').addEventListener('mouseleave', startBannerRotation);
$('bannerSlider').addEventListener('focusin', stopBannerRotation);
$('bannerSlider').addEventListener('focusout', (event) => { if (!event.currentTarget.contains(event.relatedTarget)) startBannerRotation(); });
loadBannerSlides();

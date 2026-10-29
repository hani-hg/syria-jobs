const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const GOVERNORATES = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'درعا', 'السويداء', 'القنيطرة', 'دير الزور', 'الحسكة', 'الرقة'];
const FIELDS = ['تقنية المعلومات', 'التعليم', 'الطب والرعاية الصحية', 'المحاسبة والمال', 'الهندسة', 'الإدارة', 'المبيعات والتسويق', 'القانون', 'الإعلام', 'الخدمات', 'النقل واللوجستيات', 'الصناعة', 'الزراعة', 'السياحة والضيافة', 'أخرى'];
let currentStatus = 'pending';
let currentUser = null;
let allItems = [];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '—';

function fillSelect(el, items, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>` + items.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function showMessage(target, message, error = false) {
  const element = $(target);
  element.textContent = message;
  element.className = `admin-message${error ? ' error' : ''}`;
}

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  setTimeout(() => { toast.className = 'toast'; }, 4000);
}

async function openDashboard() {
  $('#loginPanel').hidden = true;
  $('#dashboardPanel').hidden = false;
  $('#signOutBtn').hidden = true;
  $('#signOutBtnAlt').hidden = true;
  await loadSubmissions();
}

async function loadSubmissions() {
  showMessage('#adminMessage', 'جارٍ تحميل الطلبات...');
  const { data, error } = await client.from('job_submissions').select('*').order('created_at', { ascending: false });
  if (error) { showMessage('#adminMessage', 'تعذر تحميل الطلبات: ' + error.message, true); return; }
  allItems = data || [];
  const counts = { pending: 0, approved: 0, rejected: 0 };
  allItems.forEach((item) => { if (counts[item.status] !== undefined) counts[item.status] += 1; });
  $('#pendingCount').textContent = counts.pending;
  $('#approvedCount').textContent = counts.approved;
  $('#rejectedCount').textContent = counts.rejected;
  const list = currentStatus === 'all' ? allItems : allItems.filter((item) => item.status === currentStatus);
  renderSubmissions(list);
  showMessage('#adminMessage', `تم تحميل ${list.length} طلب.`);
}

function renderSubmissions(items) {
  if (!items.length) { $('#submissionsList').innerHTML = '<div class="admin-empty">لا توجد طلبات في هذا القسم.</div>'; return; }
  $('#submissionsList').innerHTML = items.map((item) => `<article class="submission-card"><div class="submission-head"><div><span class="status status-${escapeHtml(item.status)}">${item.status === 'pending' ? 'قيد المراجعة' : item.status === 'approved' ? 'معتمد' : 'مرفوض'}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.company)} · ${escapeHtml(item.governorate)} · ${escapeHtml(item.field)}</p></div><time>${new Date(item.created_at).toLocaleString('ar-SY')}</time></div><div class="submission-details"><p><b>النوع:</b> ${escapeHtml(item.type)} &nbsp; <b>آخر موعد:</b> ${formatDate(item.deadline)}${item.contact ? ` &nbsp; <b>تواصل:</b> ${escapeHtml(item.contact)}` : ''}</p><p>${escapeHtml(item.description)}</p><a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">فتح رابط المصدر</a></div><div class="submission-actions">${item.status !== 'approved' ? '<button class="btn btn-approve" type="button" data-action="approved" data-id="' + item.id + '">اعتماد ونشر</button>' : ''}${item.status !== 'rejected' ? '<button class="btn btn-reject" type="button" data-action="rejected" data-id="' + item.id + '">رفض</button>' : ''}<button class="btn btn-ghost" type="button" data-action="edit" data-id="${item.id}">تعديل</button><button class="btn btn-delete" type="button" data-action="delete" data-id="${item.id}">حذف نهائي</button></div></article>`).join('');
}

async function updateStatus(id, status) {
  const label = status === 'approved' ? 'اعتماد هذا الإعلان ونشره؟' : 'رفض هذا الطلب؟';
  if (!confirm(label)) return;
  const { error } = await client.from('job_submissions').update({ status }).eq('id', id);
  if (error) { showToast('فشل تحديث الحالة: ' + error.message, true); return; }
  showToast(status === 'approved' ? 'تم اعتماد الإعلان ونشره.' : 'تم رفض الطلب.');
  await loadSubmissions();
}

async function deleteSubmission(id) {
  if (!confirm('سيُحذف الطلب نهائيًا. هل أنت متأكد؟')) return;
  const { error } = await client.from('job_submissions').delete().eq('id', id);
  if (error) { showToast('فشل الحذف: ' + error.message, true); return; }
  showToast('تم حذف الطلب نهائيًا.');
  await loadSubmissions();
}

function openEditor(item) {
  const form = $('#editorForm');
  form.reset();
  form.id.value = item?.id || '';
  form.title.value = item?.title || '';
  form.company.value = item?.company || '';
  form.governorate.value = item?.governorate || '';
  form.field.value = item?.field || '';
  form.type.value = item?.type || 'خاص';
  form.status.value = item?.status || 'approved';
  form.deadline.value = item?.deadline || '';
  form.contact.value = item?.contact || '';
  form.source.value = item?.source || '';
  form.description.value = item?.description || '';
  $('#editorTitle').textContent = item ? 'تعديل الوظيفة' : 'إضافة وظيفة';
  $('#editorPanel').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeEditor() {
  $('#editorPanel').hidden = true;
  document.body.style.overflow = '';
}

async function saveEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    title: data.title.trim(),
    company: data.company.trim(),
    governorate: data.governorate.trim(),
    field: data.field.trim(),
    type: data.type,
    deadline: data.deadline,
    source: data.source.trim(),
    description: data.description.trim(),
    contact: (data.contact || '').trim(),
    status: data.status || 'approved'
  };
  button.disabled = true;
  try {
    let error;
    if (data.id) ({ error } = await client.from('job_submissions').update(payload).eq('id', data.id));
    else ({ error } = await client.from('job_submissions').insert(payload));
    if (error && /contact/i.test(error.message || '')) {
      const fallback = { ...payload };
      delete fallback.contact;
      if (payload.contact) fallback.description = `${payload.description}\n\nالتواصل: ${payload.contact}`;
      if (data.id) ({ error } = await client.from('job_submissions').update(fallback).eq('id', data.id));
      else ({ error } = await client.from('job_submissions').insert(fallback));
    }
    if (error) throw error;
    showToast(data.id ? 'تم حفظ التعديلات.' : 'تمت إضافة الوظيفة.');
    closeEditor();
    await loadSubmissions();
  } catch (error) {
    showToast('فشل الحفظ: ' + error.message, true);
  } finally {
    button.disabled = false;
  }
}

if ($('#loginForm')) {
  $('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); openDashboard(); });
}
$('#submissionsList').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'delete') deleteSubmission(button.dataset.id);
  else if (button.dataset.action === 'edit') openEditor(allItems.find((item) => String(item.id) === String(button.dataset.id)));
  else updateStatus(button.dataset.id, button.dataset.action);
});
document.querySelectorAll('.admin-tabs button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.admin-tabs button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  currentStatus = button.dataset.status;
  loadSubmissions();
}));
$('#refreshBtn').addEventListener('click', loadSubmissions);
$('#addJobBtn').addEventListener('click', () => openEditor(null));
$('#closeEditor').addEventListener('click', closeEditor);
$('#editorBackdrop').addEventListener('click', closeEditor);
$('#editorForm').addEventListener('submit', saveEditor);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeEditor(); });
fillSelect($('#editorGovernorate'), GOVERNORATES, 'اختر المحافظة');
fillSelect($('#editorField'), FIELDS, 'اختر المجال');
openDashboard();

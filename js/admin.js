const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentStatus = 'pending';
let currentUser = null;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '—';

function showMessage(target, message, error = false) { const element = $(target); element.textContent = message; element.className = `admin-message${error ? ' error' : ''}`; }
function showToast(message, error = false) { const toast = $('#toast'); toast.textContent = message; toast.className = `toast show${error ? ' error' : ''}`; setTimeout(() => { toast.className = 'toast'; }, 4000); }

async function isAdmin(user) {
  const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && Boolean(data);
}

async function startSession(session) {
  currentUser = session.user;
  if (!(await isAdmin(currentUser))) { await client.auth.signOut(); showMessage('#loginMessage', 'هذا الحساب غير مخوّل للوصول إلى لوحة التحكم.', true); return; }
  $('#loginPanel').hidden = true; $('#dashboardPanel').hidden = false; $('#signOutBtn').hidden = false; $('#adminEmail').textContent = currentUser.email || '';
  await loadSubmissions();
}

async function loadSubmissions() {
  showMessage('#adminMessage', 'جارٍ تحميل الطلبات...');
  const { data, error } = await client.from('job_submissions').select('*').order('created_at', { ascending: false });
  if (error) { showMessage('#adminMessage', 'تعذر تحميل الطلبات: ' + error.message, true); return; }
  const counts = { pending: 0, approved: 0, rejected: 0 };
  (data || []).forEach((item) => { if (counts[item.status] !== undefined) counts[item.status] += 1; });
  $('#pendingCount').textContent = counts.pending; $('#approvedCount').textContent = counts.approved; $('#rejectedCount').textContent = counts.rejected;
  const list = currentStatus === 'all' ? data : data.filter((item) => item.status === currentStatus);
  renderSubmissions(list || []); showMessage('#adminMessage', `تم تحميل ${list.length} طلب.`);
}

function renderSubmissions(items) {
  if (!items.length) { $('#submissionsList').innerHTML = '<div class="admin-empty">لا توجد طلبات في هذا القسم.</div>'; return; }
  $('#submissionsList').innerHTML = items.map((item) => `<article class="submission-card"><div class="submission-head"><div><span class="status status-${escapeHtml(item.status)}">${item.status === 'pending' ? 'قيد المراجعة' : item.status === 'approved' ? 'معتمد' : 'مرفوض'}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.company)} · ${escapeHtml(item.governorate)} · ${escapeHtml(item.field)}</p></div><time>${new Date(item.created_at).toLocaleString('ar-SY')}</time></div><div class="submission-details"><p><b>النوع:</b> ${escapeHtml(item.type)} &nbsp; <b>آخر موعد:</b> ${formatDate(item.deadline)}</p><p>${escapeHtml(item.description)}</p><a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">فتح رابط المصدر ↗</a></div><div class="submission-actions">${item.status !== 'approved' ? '<button class="btn btn-approve" type="button" data-action="approved" data-id="' + item.id + '">اعتماد ونشر</button>' : ''}${item.status !== 'rejected' ? '<button class="btn btn-reject" type="button" data-action="rejected" data-id="' + item.id + '">رفض</button>' : ''}<button class="btn btn-delete" type="button" data-action="delete" data-id="${item.id}">حذف نهائي</button></div></article>`).join('');
}

async function updateStatus(id, status) {
  const label = status === 'approved' ? 'اعتماد هذا الإعلان ونشره؟' : 'رفض هذا الطلب؟';
  if (!confirm(label)) return;
  const { error } = await client.from('job_submissions').update({ status }).eq('id', id);
  if (error) { showToast('فشل تحديث الحالة: ' + error.message, true); return; }
  showToast(status === 'approved' ? 'تم اعتماد الإعلان ونشره.' : 'تم رفض الطلب.'); await loadSubmissions();
}

async function deleteSubmission(id) {
  if (!confirm('سيُحذف الطلب نهائيًا. هل أنت متأكد؟')) return;
  const { error } = await client.from('job_submissions').delete().eq('id', id);
  if (error) { showToast('فشل الحذف: ' + error.message, true); return; }
  showToast('تم حذف الطلب نهائيًا.'); await loadSubmissions();
}

$('#loginForm').addEventListener('submit', async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; showMessage('#loginMessage', 'جارٍ تسجيل الدخول...'); const { data, error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value }); if (error) showMessage('#loginMessage', 'بيانات الدخول غير صحيحة أو الحساب غير مفعّل.', true); else await startSession(data.session); button.disabled = false; });
$('#togglePassword').addEventListener('click', () => { const input = $('#password'); const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; $('#togglePassword').textContent = visible ? 'إظهار' : 'إخفاء'; $('#togglePassword').setAttribute('aria-label', visible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'); });
$('#submissionsList').addEventListener('click', (event) => { const button = event.target.closest('button[data-action]'); if (!button) return; button.dataset.action === 'delete' ? deleteSubmission(button.dataset.id) : updateStatus(button.dataset.id, button.dataset.action); });
document.querySelectorAll('.admin-tabs button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.admin-tabs button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); currentStatus = button.dataset.status; loadSubmissions(); }));
$('#refreshBtn').addEventListener('click', loadSubmissions);
async function signOut() { await client.auth.signOut(); window.location.reload(); }
$('#signOutBtn').addEventListener('click', signOut); $('#signOutBtnAlt').addEventListener('click', signOut);
client.auth.getSession().then(({ data }) => { if (data.session) startSession(data.session); });

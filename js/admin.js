const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const client = window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const GOVERNORATES = ['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','درعا','السويداء','القنيطرة','دير الزور','الحسكة','الرقة'];
const FIELDS = ['تقنية المعلومات','التعليم','الطب والرعاية الصحية','المحاسبة والمال','الهندسة','الإدارة','المبيعات والتسويق','القانون','الإعلام','الخدمات','النقل واللوجستيات','الصناعة','الزراعة','السياحة والضيافة','أخرى'];
let currentStatus = 'pending';
let currentView = 'submissions';
let allItems = [];
let currentUser = null;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const datePlus = (days) => {const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const formatDate = (value) => value ? new Intl.DateTimeFormat('ar-SY',{dateStyle:'medium'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : '—';
function fillSelect(element,items,placeholder){element.innerHTML=`<option value="">${escapeHtml(placeholder)}</option>`+items.map((v)=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');}
function setMessage(element,text,error=false){element.textContent=text;element.classList.toggle('error',error);}
function showToast(text,error=false){const toast=$('#toast');toast.textContent=text;toast.className=`toast show${error?' error':''}`;setTimeout(()=>{toast.className='toast';},3500);}
function showLoggedOut(message=''){currentUser=null;$('#dashboardPanel').hidden=true;$('#loginPanel').hidden=false;$('#signOutBtn').hidden=true;if(message)setMessage($('#loginMessage'),message,true);}
async function authorize(user){
  if(!user){showLoggedOut();return;}
  const {data,error}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error||!data){await client.auth.signOut();showLoggedOut('هذا الحساب غير مضاف ضمن مديري الموقع.');return;}
  currentUser=user;$('#loginPanel').hidden=true;$('#dashboardPanel').hidden=false;$('#signOutBtn').hidden=false;$('#adminEmail').textContent=`تم تسجيل الدخول: ${user.email || ''}`;await loadSubmissions();
}
async function loadSubmissions(){
  if(!currentUser)return;
  setMessage($('#adminMessage'),'جارٍ تحميل الإعلانات…');
  const {data,error}=await client.from('job_submissions').select('*').order('created_at',{ascending:false});
  if(error){setMessage($('#adminMessage'),'تعذر تحميل الطلبات: '+error.message,true);return;}
  allItems=data||[];
  const counts={pending:0,approved:0,rejected:0};allItems.forEach((item)=>{if(counts[item.status]!==undefined)counts[item.status]++;});
  $('#pendingCount').textContent=counts.pending;$('#approvedCount').textContent=counts.approved;$('#rejectedCount').textContent=counts.rejected;
  const items=currentStatus==='all'?allItems:allItems.filter((item)=>item.status===currentStatus);
  renderSubmissions(items);setMessage($('#adminMessage'),`تم تحميل ${items.length} إعلان.`);
}

async function loadMessages(){
  if(!currentUser)return;
  setMessage($('#adminMessage'),'جارٍ تحميل الرسائل…');
  const {data,error}=await client.from('messages').select('id,name,contact,message,created_at,is_read').order('created_at',{ascending:false});
  if(error){$('#messagesList').innerHTML='<div class="admin-empty">تعذر تحميل صندوق الوارد. تأكد من تطبيق migration-contact-messages.sql.</div>';setMessage($('#adminMessage'),'تعذر تحميل الرسائل: '+error.message,true);return;}
  renderMessages(data||[]);
  setMessage($('#adminMessage'),`تم تحميل ${(data||[]).length} رسالة.`);
}
function renderMessages(messages){
  if(!messages.length){$('#messagesList').innerHTML='<div class="admin-empty">لا توجد رسائل واردة حتى الآن.</div>';return;}
  $('#messagesList').innerHTML=messages.map((message)=>`<article class="message-card ${message.is_read?'is-read':'is-unread'}"><div class="message-card-head"><div><span class="message-label ${message.is_read?'read':'unread'}">${message.is_read?'مقروءة':'غير مقروءة'}</span><h2>${escapeHtml(message.name)}</h2></div><time>${escapeHtml(formatDate(message.created_at))}</time></div><p class="message-contact"><b>وسيلة التواصل:</b> ${escapeHtml(message.contact)}</p><p class="message-body">${escapeHtml(message.message)}</p><div class="message-actions"><button class="btn btn-outline" type="button" data-message-action="toggle-read" data-id="${escapeHtml(message.id)}" data-read="${message.is_read?'true':'false'}">${message.is_read?'وضع كغير مقروءة':'تحديد كمقروءة'}</button><button class="btn btn-delete" type="button" data-message-action="delete" data-id="${escapeHtml(message.id)}">حذف الرسالة</button></div></article>`).join('');
}
async function setMessageRead(id,isRead){
  try{
    const {data,error}=await client.from('messages').update({is_read:isRead}).eq('id',id).select('id').maybeSingle();
    if(error)throw error;
    if(!data){showToast('لم تتغير الحالة. تحقق من صلاحيات المشرف وترحيل قاعدة البيانات.',true);return;}
    showToast(isRead?'تم تحديد الرسالة كمقروءة.':'تم وضع الرسالة كغير مقروءة.');
    await loadMessages();
  }catch(error){showToast('تعذر تحديث حالة الرسالة: '+(error.message||'خطأ اتصال.'),true);}
}
async function deleteMessage(id){
  if(!confirm('سيتم حذف الرسالة نهائيًا ولا يمكن استعادتها. هل تريد المتابعة؟'))return;
  try{
    const {data,error}=await client.from('messages').delete().eq('id',id).select('id').maybeSingle();
    if(error)throw error;
    if(!data){showToast('لم تُحذف الرسالة. تحقق من صلاحيات المشرف وترحيل قاعدة البيانات.',true);return;}
    showToast('تم حذف الرسالة.');
    await loadMessages();
  }catch(error){showToast('تعذر حذف الرسالة: '+(error.message||'خطأ اتصال.'),true);}
}
function setDashboardView(view,status=currentStatus){
  currentView=view;
  currentStatus=status;
  document.querySelectorAll('.admin-tabs button').forEach((button)=>{
    const active=view==='messages'?button.dataset.view==='messages':button.dataset.view==='submissions'&&button.dataset.status===status;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  $('#submissionsList').hidden=view!=='submissions';
  $('#messagesList').hidden=view!=='messages';
  $('#adminStats').hidden=view==='messages';
  $('#dashboardTitle').textContent=view==='messages'?'صندوق الوارد':'طلبات الإعلانات';
  $('#addJobBtn').hidden=view==='messages';
  if(view==='messages')loadMessages();else loadSubmissions();
}

function renderSubmissions(items){
  if(!items.length){$('#submissionsList').innerHTML='<div class="admin-empty">لا توجد إعلانات في هذا القسم.</div>';return;}
  $('#submissionsList').innerHTML=items.map((item)=>{
    const seeker=item.listing_type==='seeker';const state={pending:'قيد المراجعة',approved:'منشور',rejected:'مرفوض'}[item.status]||item.status;
    const kind=seeker?'مطلوب وظيفة':(item.type==='حكومي'?'وظيفة حكومية':'وظيفة قطاع خاص');
    return `<article class="submission-card"><div class="submission-head"><div><span class="status status-${escapeHtml(item.status)}">${state}</span><span class="listing-badge admin-kind">${kind}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.company||'باحث عن عمل')} · ${escapeHtml(item.governorate)} · ${escapeHtml(item.field)}</p></div><time>${escapeHtml(formatDate(item.created_at))}</time></div><div class="submission-details"><p><b>النوع:</b> ${kind}　<b>الانتهاء:</b> ${escapeHtml(formatDate(item.deadline))}${item.experience?`　<b>الخبرة:</b> ${escapeHtml(item.experience)}`:''}${item.work_arrangement?`　<b>العمل:</b> ${escapeHtml(item.work_arrangement)}`:''}${item.contact?`　<b>التواصل:</b> ${escapeHtml(item.contact)}`:''}</p><p>${escapeHtml(item.description)}</p>${item.source?`<a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">فتح رابط المصدر ↗</a>`:''}</div><div class="submission-actions">${item.status!=='approved'?`<button class="btn btn-approve" type="button" data-action="approved" data-id="${escapeHtml(item.id)}">اعتماد ونشر</button>`:''}${item.status!=='rejected'?`<button class="btn btn-reject" type="button" data-action="rejected" data-id="${escapeHtml(item.id)}">رفض</button>`:''}<button class="btn btn-outline" type="button" data-action="edit" data-id="${escapeHtml(item.id)}">تعديل</button><button class="btn btn-delete" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">حذف</button></div></article>`;
  }).join('');
}
async function updateStatus(id,status){const label=status==='approved'?'اعتماد الإعلان ونشره؟':'رفض الإعلان؟';if(!confirm(label))return;const item=allItems.find((entry)=>String(entry.id)===String(id));const changes={status};if(status==='approved'&&item?.listing_type==='seeker')changes.deadline=datePlus(60);const {error}=await client.from('job_submissions').update(changes).eq('id',id);if(error){showToast('تعذر تحديث الإعلان: '+error.message,true);return;}showToast(status==='approved'?'تم اعتماد الإعلان.':'تم رفض الإعلان.');await loadSubmissions();}
async function deleteSubmission(id){if(!confirm('سيُحذف الإعلان نهائيًا. هل تريد المتابعة؟'))return;const {error}=await client.from('job_submissions').delete().eq('id',id);if(error){showToast('تعذر الحذف: '+error.message,true);return;}showToast('تم حذف الإعلان.');await loadSubmissions();}
function openEditor(item=null){const form=$('#editorForm');form.reset();form.elements.namedItem('id').value=item?.id||'';form.elements.namedItem('listing_type').value=item?.listing_type||'job';form.elements.namedItem('type').value=item?.type||'خاص';form.elements.namedItem('status').value=item?.status||'approved';form.elements.namedItem('title').value=item?.title||'';form.elements.namedItem('company').value=item?.company||'';form.elements.namedItem('governorate').value=item?.governorate||'';form.elements.namedItem('field').value=item?.field||'';form.elements.namedItem('deadline').value=item?.deadline||datePlus(form.elements.namedItem('listing_type').value==='seeker'?60:30);form.elements.namedItem('experience').value=item?.experience||'';form.elements.namedItem('work_arrangement').value=item?.work_arrangement||'';form.elements.namedItem('source').value=item?.source||'';form.elements.namedItem('contact').value=item?.contact||'';form.elements.namedItem('description').value=item?.description||'';$('#editorTitle').textContent=item?'تعديل الإعلان':'إضافة إعلان';$('#editorBackdrop').hidden=false;document.body.style.overflow='hidden';}
function closeEditor(){ $('#editorBackdrop').hidden=true;document.body.style.overflow=''; }
async function saveEditor(event){event.preventDefault();if(!currentUser)return;const form=event.currentTarget;const data=Object.fromEntries(new FormData(form).entries());const seeker=data.listing_type==='seeker';if(!seeker&&!data.source.trim()){showToast('أضف رابط مصدر الإعلان قبل حفظ الوظيفة.',true);return;}const original=allItems.find((item)=>String(item.id)===String(data.id));const deadline=seeker&&data.status==='approved'&&original?.status!=='approved'?datePlus(60):data.deadline;const payload={listing_type:data.listing_type,title:data.title.trim(),company:seeker?(data.company.trim()||'باحث عن عمل'):(data.company.trim()||'جهة معلنة'),governorate:data.governorate,field:data.field,type:data.type,deadline,source:seeker?null:(data.source.trim()||null),description:data.description.trim(),contact:data.contact.trim()||null,experience:seeker?(data.experience.trim()||null):null,work_arrangement:seeker?(data.work_arrangement.trim()||null):null,status:data.status||'pending'};const button=form.querySelector('[type="submit"]');button.disabled=true;try{const result=data.id?await client.from('job_submissions').update(payload).eq('id',data.id):await client.from('job_submissions').insert(payload);if(result.error)throw result.error;showToast(data.id?'تم حفظ التعديلات.':'تمت إضافة الإعلان.');closeEditor();await loadSubmissions();}catch(error){showToast('فشل الحفظ: '+error.message,true);}finally{button.disabled=false;}}
$('#loginForm').addEventListener('submit',async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;setMessage($('#loginMessage'),'جارٍ التحقق…');const {data,error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});button.disabled=false;if(error){setMessage($('#loginMessage'),'تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.',true);return;}await authorize(data.user);});
$('#signOutBtn').addEventListener('click',async()=>{await client.auth.signOut();showLoggedOut('تم تسجيل الخروج.');});
$('#refreshBtn').addEventListener('click',()=>currentView==='messages'?loadMessages():loadSubmissions());$('#addJobBtn').addEventListener('click',()=>openEditor());$('#closeEditor').addEventListener('click',closeEditor);$('#editorBackdrop').addEventListener('click',(event)=>{if(event.target===$('#editorBackdrop'))closeEditor();});$('#editorForm').addEventListener('submit',saveEditor);
$('#submissionsList').addEventListener('click',(event)=>{const button=event.target.closest('button[data-action]');if(!button)return;if(button.dataset.action==='edit')openEditor(allItems.find((item)=>String(item.id)===button.dataset.id));else if(button.dataset.action==='delete')deleteSubmission(button.dataset.id);else updateStatus(button.dataset.id,button.dataset.action);});
$('#messagesList').addEventListener('click',(event)=>{const button=event.target.closest('button[data-message-action]');if(!button)return;button.disabled=true;if(button.dataset.messageAction==='delete')deleteMessage(button.dataset.id).finally(()=>{button.disabled=false;});else if(button.dataset.messageAction==='toggle-read')setMessageRead(button.dataset.id,button.dataset.read!=='true').finally(()=>{button.disabled=false;});});
document.querySelectorAll('.admin-tabs button[data-status]').forEach((button)=>button.addEventListener('click',()=>setDashboardView('submissions',button.dataset.status)));
$('[data-view=messages]').addEventListener('click',()=>setDashboardView('messages'));
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeEditor();});
fillSelect($('#editorGovernorate'),GOVERNORATES,'اختر المحافظة');fillSelect($('#editorField'),FIELDS,'اختر المجال');
$('#dashboardPanel').hidden=true;
client.auth.getSession().then(({data})=>authorize(data.session?.user||null));
client.auth.onAuthStateChange((_event,session)=>{if(!session)showLoggedOut();});

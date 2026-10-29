// ===== إعدادات Supabase =====
const SUPABASE_URL = 'https://zpbwsdjyzgtlwwpfywcg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndzZGp5emd0bHd3cGZ5d2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTU0MDYsImV4cCI6MjEwODc3MTQwNn0.CjnXWEnxM-u9lW9ftzu4BcLL6FR0qLt-i1AD5J7CcIE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let ads = []; // ستُملأ من قاعدة البيانات

function fmtDate(d){
  if(!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('ar-EG', {day:'numeric', month:'short', year:'numeric'});
}

function isExpired(d){
  if(!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

function populateFilters(){
  const locs = [...new Set(ads.map(a=>a.governorate).filter(Boolean))];
  const cats = [...new Set(ads.map(a=>a.field).filter(Boolean))];
  const locSel = document.getElementById('locationFilter');
  const catSel = document.getElementById('categoryFilter');
  locSel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
  catSel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
  locs.forEach(l=>{
    const o = document.createElement('option'); o.value=l; o.textContent=l; locSel.appendChild(o);
  });
  cats.forEach(c=>{
    const o = document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o);
  });
}

function render(){
  const q = document.getElementById('searchInput').value.trim();
  const loc = document.getElementById('locationFilter').value;
  const cat = document.getElementById('categoryFilter').value;
  const type = document.getElementById('typeFilter').value;

  const filtered = ads.filter(a=>{
    if (isExpired(a.deadline)) return false;
    if (q && !(a.title && a.title.includes(q))) return false;
    if (loc && a.governorate !== loc) return false;
    if (cat && a.field !== cat) return false;
    if (type && a.type !== type) return false;
    return true;
  });

  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  document.getElementById('resultCount').textContent = `${filtered.length} إعلان`;
  document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(a=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <h4>${a.title}</h4>
      <div class="badges">
        ${a.type ? `<span class="badge gold">${a.type}</span>` : ''}
        ${a.governorate ? `<span class="badge">${a.governorate}</span>` : ''}
        ${a.field ? `<span class="badge">${a.field}</span>` : ''}
        ${a.deadline ? `<span class="badge deadline">آخر موعد: ${fmtDate(a.deadline)}</span>` : ''}
      </div>
      <p>${a.description || ''}</p>
      <div class="card-foot">
        <span style="font-size:12.5px;color:var(--muted)">${a.company || ''}</span>
        ${a.source ? `<a href="${a.source}" target="_blank">المصدر</a>` : '<span></span>'}
      </div>
    `;
    container.appendChild(el);
  });
}

// جلب الإعلانات المنشورة فقط من Supabase
async function loadAds(){
  const { data, error } = await supabaseClient
    .from('jobs')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if(error){
    console.error('خطأ في جلب الإعلانات:', error);
    document.getElementById('resultCount').textContent = 'تعذّر تحميل الإعلانات';
    return;
  }

  ads = data || [];
  populateFilters();
  render();
}

function openModal(){ document.getElementById('modalBg').classList.add('open'); }
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

async function submitAd(){
  const title = document.getElementById('mTitle').value.trim();
  const company = document.getElementById('mCompany').value.trim();
  const governorate = document.getElementById('mLocation').value.trim();
  const source = document.getElementById('mSource').value.trim();
  const description = document.getElementById('mBody').value.trim();
  const contact = document.getElementById('mContact').value.trim();

  if(!title || !company || !governorate || !description || !contact || !source){
    alert('يرجى تعبئة جميع الحقول، رابط المصدر إلزامي');
    return;
  }

  const { error } = await supabaseClient
    .from('jobs')
    .insert([{
      title, company, governorate, source,
      description: description + '\nللتواصل: ' + contact,
      type: 'خاص',
      status: 'pending'
    }]);

  if(error){
    console.error('خطأ في إرسال الإعلان:', error);
    alert('حدث خطأ أثناء الإرسال، حاول مرة أخرى');
    return;
  }

  alert('تم استلام طلبك، سيُنشر بعد المراجعة.');
  closeModal();
}

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('locationFilter').addEventListener('change', render);
document.getElementById('categoryFilter').addEventListener('change', render);
document.getElementById('typeFilter').addEventListener('change', render);

loadAds();

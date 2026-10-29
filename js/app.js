// بيانات تجريبية مبدئية — ستُستبدل لاحقاً ببيانات من قاعدة البيانات
const ads = [
  {
    title: "محاسب / محاسبة",
    type: "حكومي",
    location: "دير الزور",
    category: "مالي",
    deadline: "2026-11-15",
    body: "مطلوب محاسب لدى إحدى الجهات الحكومية، يشترط إجازة جامعية في المحاسبة أو ما يعادلها.",
    source: "#",
    sourceName: "وزارة التنمية الإدارية"
  },
  {
    title: "سائق باص داخلي",
    type: "حكومي",
    location: "دمشق",
    category: "خدمي",
    deadline: "2026-11-05",
    body: "مطلوب سائقين لباصات النقل الداخلي، رخصة قيادة سارية ومن سكان المحافظة.",
    source: "#",
    sourceName: "سانا"
  },
  {
    title: "موظف استقبال",
    type: "خاص",
    location: "دير الزور",
    category: "إداري",
    deadline: "2026-11-20",
    body: "محل تجاري بدير الزور يطلب موظف استقبال، إجادة التعامل مع العملاء وبرامج Office.",
    source: "",
    sourceName: ""
  }
];

function fmtDate(d){
  const date = new Date(d);
  return date.toLocaleDateString('ar-EG', {day:'numeric', month:'short', year:'numeric'});
}

function isExpired(d){
  return new Date(d) < new Date(new Date().toDateString());
}

function populateFilters(){
  const locs = [...new Set(ads.map(a=>a.location))];
  const cats = [...new Set(ads.map(a=>a.category))];
  const locSel = document.getElementById('locationFilter');
  const catSel = document.getElementById('categoryFilter');
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
    if (q && !a.title.includes(q)) return false;
    if (loc && a.location !== loc) return false;
    if (cat && a.category !== cat) return false;
    if (type && a.type !== type) return false;
    return true;
  });

  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  document.getElementById('resultCount').textContent = `${filtered.length} فرصة متاحة`;
  document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(a=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <h3>${a.title}</h3>
      <div class="badges">
        <span class="badge gold">${a.type}</span>
        <span class="badge">${a.location}</span>
        <span class="badge">${a.category}</span>
        <span class="badge deadline">آخر موعد: ${fmtDate(a.deadline)}</span>
      </div>
      <p>${a.body}</p>
      <div class="card-foot">
        ${a.source ? `<a href="${a.source}" target="_blank">المصدر: ${a.sourceName}</a>` : '<span></span>'}
      </div>
    `;
    container.appendChild(el);
  });
}

function openModal(){ document.getElementById('modalBg').classList.add('open'); }
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

function submitAd(){
  const title = document.getElementById('mTitle').value.trim();
  const company = document.getElementById('mCompany').value.trim();
  const location = document.getElementById('mLocation').value.trim();
  const source = document.getElementById('mSource').value.trim();
  const body = document.getElementById('mBody').value.trim();
  const contact = document.getElementById('mContact').value.trim();
  if(!title || !location || !body || !contact || !source){
    alert('يرجى تعبئة جميع الحقول، رابط المصدر إلزامي');
    return;
  }
  // هنا لاحقاً: إرسال البيانات إلى قاعدة البيانات (Supabase) بحالة "قيد المراجعة"
  alert('تم استلام طلبك، سيُنشر بعد المراجعة.');
  closeModal();
}

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('locationFilter').addEventListener('change', render);
document.getElementById('categoryFilter').addEventListener('change', render);
document.getElementById('typeFilter').addEventListener('change', render);

document.getElementById('lastUpdated').textContent =
  'آخر تحديث: ' + new Date().toLocaleDateString('ar-EG', {day:'numeric', month:'short'});

populateFilters();
render();

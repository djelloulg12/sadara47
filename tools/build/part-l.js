/* ==========================================================
   صورة المنخرط + قصر طباعة كل البطاقات على الإدارة
   ========================================================== */
const PRINT_ALL_ROLES = ['admin', 'president', 'manager', 'coach'];
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
function canPrintAllCards(){
  return PRINT_ALL_ROLES.includes((state.user || {}).role);
}
function photoStoragePath(uid, name){
  const safe = String(name || 'photo').replace(/[^\w.\-]+/g, '_').slice(-40);
  return 'member-photos/' + uid + '/' + safe + '-' + Date.now() + '.jpg';
}
function readPhotoFile(file){
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('اختر صورة أولاً.'));
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) return reject(new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.'));
    if (file.size > PHOTO_MAX_BYTES) return reject(new Error('حجم الصورة يتجاوز 3 ميغابايت.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
    reader.readAsDataURL(file);
  });
}
async function saveMyPhoto(file){
  try {
    const dataUrl = await readPhotoFile(file);
    const uid = (state.user && state.user.id) || 'local';
    let photoUrl = dataUrl;
    if (window.firebase && firebase.storage && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      const ref = firebase.storage().ref(photoStoragePath(uid, file.name));
      const snapshot = await ref.put(file, { contentType: file.type });
      photoUrl = await snapshot.ref.getDownloadURL();
    }
    const saved = await api('/api/profile', 'PUT', { photo: photoUrl });
    state.profile = Object.assign({}, state.profile, { photo: (saved.profile && saved.profile.photo) || photoUrl });
    save(); render(); showToast('تم حفظ صورتك.');
  } catch (e) {
    showToast(e.message || 'تعذر حفظ الصورة.', 'error');
  }
}

/* ---------- قسم الصورة داخل صفحة ملفي ---------- */
const coreProfilePage=profilePage;
profilePage=function(){
  const html = coreProfilePage();
  const photo = (state.profile && state.profile.photo) || '';
  const box = '<section class="panel pf-photo-panel"><div class="panel-head"><div><h3>صورتي الشخصية</h3>'
    + '<p>تظهر على بطاقتك وعلى استمارة الإلحاق — يفضّل صورة واضحة بخلفية بيضاء.</p></div></div>'
    + '<div class="pf-photo-row">'
    + '<div class="pf-photo-preview">' + (photo
        ? '<img src="' + esc(photo) + '" alt="صورتي">'
        : '<span class="pf-photo-empty">لا توجد صورة</span>') + '</div>'
    + '<div class="pf-photo-actions">'
    + '<label class="btn btn-outline">📷 اختيار صورة<input id="my-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>'
    + (photo ? '<button class="check-btn no" data-action="remove-my-photo">حذف الصورة</button>' : '')
    + '<p class="page-description">JPG أو PNG أو WebP — بحد أقصى 3 ميغابايت.</p>'
    + '</div></div></section>';
  return html + box;
};

/* ---------- ربط كل شيء ---------- */
const coreAction4=action;
action=async function(a,el){
  if(a==='upload-my-photo'){await saveMyPhoto(el?.files?.[0]);return}
  if(a==='remove-my-photo'){
    try{await api('/api/profile','PUT',{photo:''});state.profile.photo='';save();render();showToast('تم حذف الصورة.')}
    catch(e){showToast(e.message||'تعذر الحذف.','error')}
    return;
  }
  if(a==='print-campaign'||a==='print-cards'||a==='print-all-cards'||a==='print-cards-quick'||a==='print-lux-swimmers'){
    if(!canPrintAllCards()){
      showToast('طباعة جميع البطاقات متاحة للمدير ورئيس النادي والمسيّر فقط.', 'error');
      return;
    }
    return coreAction4(a,el);
  }
  return coreAction4(a,el);
};

/* ----------Styles ---------- */

/* The file input is bound on every render.

   This takes the binding it is given and adds one line to it, rather than writing
   the table out again. It used to restate it, and the restatement won -- so a
   control bound in the baseline was unbound in the built file whenever this copy
   did not repeat it, with nothing to show for it: the page rendered, the control
   was there, and pressing it did nothing. That is how the switch for showing the
   decided requests arrived unbound. */
const coreBindList = bind;
bind = function () {
  coreBindList();
  const file = document.querySelector('#my-photo');
  if (file) file.onchange = () => action('upload-my-photo', { files: file.files });
};

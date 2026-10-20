/* ==========================================================
   تخزين الصور خارج localStorage + عدّاد الزوار
   الصور كانت تُحفظ كنص داخل localStorage، وهذا يملأ الحصة
   بسرعة ويُضعف الأداء. IndexedDB يحفظها بلا حصّة.
   ========================================================== */
const PHOTO_DB = 'sadara-photos';
const PHOTO_STORE = 'img';

function openPhotoDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB غير متاح'));
    let request;
    try { request = indexedDB.open(PHOTO_DB, 1); }
    catch (e) { return reject(e); }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذّر فتح مخزن الصور'));
  });
}
async function photoStorePut(key, dataUrl) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(dataUrl, String(key));
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function photoStoreGet(key) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(String(key));
    req.onsuccess = () => { db.close(); resolve(req.result || ''); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function photoStoreDel(key) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(String(key));
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/* الصورة تعشي في القاعدة، وIndexedDB يُحتفظ محمًاً فقط
   The picture belongs in the database. It used to be written to IndexedDB and
   reported back with an empty photo, so the /api/profile write was skipped and
   the database never received it. IndexedDB almost always succeeds, so the only
   copy lived on the device that uploaded it: another phone saw no photo, the
   card printed blank, and the upload still said it had worked.

   shrinkPhoto() has already brought the image under 100 KB, and a Firestore
   document holds about 1 MB, so it fits comfortably. IndexedDB is kept as a
   cache -- it makes the picture appear without waiting on the network -- but it
   is never the only copy again. */
async function persistPhoto(dataUrl) {
  const key = (state.user && state.user.id) || 'guest';
  let cached = false;
  try { await photoStorePut(key, dataUrl); cached = true; } catch (_) { /* cache is optional */ }
  return { photo: dataUrl, photo_in_store: cached };
}
/* The database is the source of truth; the local cache only covers a picture that
   was never saved, so a member who cleared this device still sees their photo. */
async function restorePhoto() {
  if (state.profile && state.profile.photo) return state.profile.photo;
  const key = (state.user && state.user.id) || 'guest';
  try {
    const saved = await api('/api/profile', 'GET');
    const fromServer = saved && saved.profile && saved.profile.photo;
    if (fromServer) {
      state.profile = Object.assign({}, state.profile, { photo: fromServer });
      return fromServer;
    }
  } catch (_) { /* not signed in, or offline */ }
  try {
    const stored = await photoStoreGet(key);
    if (stored) {
      state.profile = Object.assign({}, state.profile, { photo: stored, photo_in_store: true });
      return stored;
    }
  } catch (_) { /* no store available */ }
  return '';
}

/* التصغير قبل الحفظ: صورة هاتف 4 ميغابايت تصبح أقل من 100 كيلوبايت */
async function shrinkPhoto(file, maxSide, quality) {
  const dataUrl = await readPhotoFile(file);
  if (!window.Image || !document.createElement('canvas')) return dataUrl;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const limit = maxSide || 900;
      const scale = Math.min(1, limit / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL('image/jpeg', quality || 0.82)); }
      catch (_) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const coreSaveMyPhoto = saveMyPhoto;
saveMyPhoto = async function (file) {
  if (!file) { showToast('اختر صورة أولًا.', 'error'); return; }
  if (!/^image\//.test(file.type)) { showToast('الملف يجب أن يكون صورة.', 'error'); return; }
  try {
    const small = await shrinkPhoto(file, 900, 0.82);
    const stored = await persistPhoto(small);
    if (stored.photo) {
      await api('/api/profile', 'PUT', { photo: stored.photo });
      state.profile = Object.assign({}, state.profile, { photo: stored.photo });
      save();
    } else {
      state.profile = Object.assign({}, state.profile, { photo: small, photo_in_store: true });
      save();
    }
    render();
    showToast('تم حفظ صورتك.');
  } catch (e) {
    showToast(e.message || 'تعذّر حفظ الصورة', 'error');
  }
};

const coreRemoveMyPhoto = action;
action = async function (a, el) {
  if (a === 'remove-my-photo') {
    try {
      await photoStoreDel((state.user && state.user.id) || 'guest');
    } catch (_) { /* nothing to clear */ }
    return coreRemoveMyPhoto(a, el);
  }
  return coreRemoveMyPhoto(a, el);
};

/*restore the photo kept outside localStorage before the first paint*/
const coreRenderPhoto = render;
render = function () {
  coreRenderPhoto();
  if (state.user && state.profile && !state.profile.photo) {
    restorePhoto().then(url => { if (url && url !== state.profile.photo) coreRenderPhoto(); });
  }
};


/* عدّاد الزيارات أُزيل من هنا.
   ----------------------------------------------------------------------------
   كان يقرأ `/api/visit` و`/api/visits`، وهما مساران من عهد Firestore لم
   يُنقلا إلى خادم Neon. فكان كل فتح للصفحة الرئيسية يطلب مسارًا غير موجود
   (404)، وطبقةُ الصمود تعدّ كل ردّ غير ناجح فشلًا في المزامنة -- فتظهر لافتة
   «قد تكون البيانات قديمة» على بيانات لم يفشل فيها شيء، ويزداد سجلّ الطرفية
   ضجيجًا لا يقود إلى عطل.

   والرقم نفسه لم يظهر يومًا: `visitTotals.visits` يبقى صفرًا فيُعيد
   `visitStampHtml` نصًّا فارغًا. فالصدق أن يُحذف ما لا يعمل، لا أن يُصمَت.
   وإذا أراد النادي عدّادًا حقيقيًا فمكانه جدول في Neon ومساران في الخادم، لا
   طلبٌ يُرسَل إلى العدم في كل زيارة. */

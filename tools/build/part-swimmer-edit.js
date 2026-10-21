/* The manager's form for one member: the whole record, and the photograph.

   What this replaces, and why it existed at all.

   The button said تعديل -- edit -- and opened a form with four fields in it: a
   name, a group, a telephone number and a state. The member's record carries
   fifteen more: a day of birth, a blood group, a level, a facility, a national
   number, a WhatsApp number, an address, a nationality, a photograph, and the
   guardian who signed for them. None of them were in the form, and none of them
   could be reached from it. Somebody correcting a child's date of birth had to
   find another way to do it, and there was not another way.

   And the four that were there were not safe either: saving wrote
   `name: value || ''` for every field the form did not send, so changing a
   telephone number blanked the name. A form that erases what you did not touch
   is not an edit form; it is a way of losing a record by accident.

   So: every field the record carries, a photograph that can be changed or added,
   and the guardian -- who is not on the member at all but on the request they
   were accepted from, and is edited there, because that is where they are read
   from too.

   The photograph is read in the page and shrunk before it is sent, because a
   camera photograph is three megabytes of text and the record is read on every
   card the club prints. Nothing is uploaded anywhere new: it goes to the member's
   own record, and it is read back from there.
*/

const SWIMMER_EDIT_FIELDS = [
  { key: 'name', label: 'الاسم واللقب *', type: 'text', wide: true },
  { key: 'first_name_ar', label: 'الاسم بالعربية', type: 'text' },
  { key: 'last_name_ar', label: 'اللقب بالعربية', type: 'text' },
  { key: 'birth_date', label: 'تاريخ الميلاد', type: 'date' },
  { key: 'gender', label: 'الجنس', type: 'choice', options: ['', 'ذكر', 'أنثى'] },
  { key: 'national_id', label: 'رقم التعريف الوطني', type: 'text', ltr: true },
  { key: 'blood_group', label: 'فصيلة الدم', type: 'choice', options: ['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
  { key: 'level', label: 'المستوى', type: 'text' },
  { key: 'facility', label: 'المنشأة / المسبح', type: 'text' },
  { key: 'group_name', label: 'الفوج', type: 'group' },
  { key: 'phone', label: 'الهاتف', type: 'tel', ltr: true },
  { key: 'whatsapp', label: 'الواتساب', type: 'tel', ltr: true },
  { key: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true },
  { key: 'address', label: 'العنوان', type: 'text', wide: true },
  { key: 'status', label: 'الحالة', type: 'status' }
];

/* 18 سنة فما فوق: لا وليّ. الحساب يعرض بيانات السباح ورقمه الوطني وحده. */
function swimmerIsAdult_(s) {
  const value = s && s.birth_date;
  let b;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return false;
    b = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  } else {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return false;
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (plain) b = new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
    else {
      const parsed = new Date(text);
      if (isNaN(parsed.getTime())) return false;
      b = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 18;
}

const GUARDIAN_EDIT_FIELDS = [
  { key: 'guardian_first_name', label: 'اسم الولي', type: 'text' },
  { key: 'guardian_last_name', label: 'لقب الولي', type: 'text' },
  { key: 'guardian_relation', label: 'صلة القرابة', type: 'text' },
  { key: 'guardian_phone', label: 'هاتف الولي', type: 'tel', ltr: true },
  { key: 'guardian_national_id', label: 'رقم التعريف الوطني للولي (18 رقمًا)', type: 'text', ltr: true },
  { key: 'guardian_birth_date', label: 'تاريخ ميلاد الولي', type: 'date' }
];

function swimmerEditField(f, value) {
  const v = value === undefined || value === null ? '' : String(value);
  const id = 'swf-' + f.key.replace(/_/g, '-');
  const dir = f.ltr ? ' dir="ltr"' : '';
  const common = 'id="' + esc(id) + '"' + dir + ' data-swimmer-field="' + esc(f.key) + '"';

  if (f.type === 'choice' || f.type === 'group' || f.type === 'status') {
    const options = f.type === 'group' ? groupOptions(value, true)
      : f.type === 'status' ? ['نشط', 'موقوف', 'بانتظار'].map(s =>
          '<option value="' + esc(s) + '"' + (String(value) === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('')
      : f.options.map(o =>
          '<option value="' + esc(o) + '"' + (String(value) === o ? ' selected' : '') + '>' + esc(o || '—') + '</option>').join('');
    return '<label>' + esc(f.label) + '<select ' + common + '>' + options + '</select></label>';
  }

  const inputType = f.type === 'date' ? 'date' : (f.type === 'tel' ? 'tel' : (f.type === 'email' ? 'email' : 'text'));
  /* رقم الولي هو مفتاح العائلة: لا يُكتب نصفه. والحدّ في الحقل نفسه حتى يرى
     المسير الخطأ قبل الحفظ، والخادم يرفضه أيضًا. */
  const nin = f.key === 'guardian_national_id'
    ? ' inputmode="numeric" maxlength="18" pattern="[0-9]{18}" placeholder="18 رقمًا"'
    : '';
  return '<label>' + esc(f.label) + '<input ' + common + nin + ' type="' + inputType + '" value="' + esc(v) + '"></label>';
}

/* A member's own photograph, drawn and changeable.

   Kept beside the fields rather than on the profile page, because the moment it
   is wanted is the moment somebody is editing a member and notices the picture is
   wrong -- which is not the moment they are on their own profile. */
function swimmerPhotoBox(s) {
  const photo = (s && (s.photo || s.photoDataUrl || s.photo_url)) || '';
  return '' +
    '<section class="swf-photo">' +
      '<div class="swf-photo-frame">' + (photo && /^(data:|https?:)/.test(photo)
        ? '<img id="swf-photo-img" src="' + esc(photo) + '" alt="صورة السباح">'
        : '<span id="swf-photo-empty">بلا صورة</span>') + '</div>' +
      '<div class="swf-photo-actions">' +
        '<label class="btn btn-outline">📷 اختيار صورة' +
          '<input id="swf-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        (photo ? '<button type="button" class="check-btn no" data-action="swf-remove-photo">حذف الصورة</button>' : '') +
        '<p class="swf-photo-note">تظهر على البطاقة وعلى استمارة الإلحاق · JPG أو PNG أو WebP · بحد أقصى 3 ميغابايت</p>' +
      '</div>' +
    '</section>';
}

function swimmerModal(s) {
  const isEdit = !!s;
  if (!isEdit) {
    /* Adding a member from the roster is a different act from correcting one: the
       number is the club's to give, and the photograph and the guardian come with
       the request rather than with a person typed in by hand. So the two forms are
       not merged into one that is wrong half the time. */
    return formModal('إضافة سباح جديد',
      '<div class="form-two">'
      + '<label>الاسم واللقب *<input id="sw-name"></label>'
      + '<label>رقم الانخراط<input id="sw-no" dir="ltr" placeholder="يُولَّد تلقائيًا"></label>'
      + '<label>الفوج<select id="sw-group">' + groupOptions(null) + '</select></label>'
      + '<label>الهاتف<input id="sw-phone" dir="ltr"></label>'
      + '<label>الحالة<select id="sw-status"><option>نشط</option><option>موقوف</option><option>بانتظار</option></select></label>'
      + '</div>',
      'save-swimmer');
  }

  const state_ = (typeof state !== 'undefined' && state) || {};
  const fromRequest = s.from_application || s.application_no || '';
  const request = fromRequest
    ? ((state_.applications || []).find(a => String(a.id) === String(fromRequest)
      || String(a.application_no || '') === String(fromRequest)) || {})
    : {};

  const guardianValues = {};
  for (const f of GUARDIAN_EDIT_FIELDS) {
    guardianValues[f.key] = (s && s[f.key]) || request[f.key] || '';
  }

  const fields = SWIMMER_EDIT_FIELDS.map(f =>
    '<label data-wide="' + (f.wide ? '1' : '') + '">' + swimmerEditField(f, s[f.key]).replace(/^<label>/, '').replace(/<\/label>$/, '') + '</label>'
  ).join('');

  /* الولي يظهر دائمًا، ولو لم يُولد السباح من طلب. البيانات القديمة لم تكن
     تحمل رقم وليّ، والمسير هو من يقرأ البطاقة الورقية ويُدخل الرقم من هنا --
     وهذا هو المدخل الوحيد لربط عائلة قديمة بلوحة العائلة. */
  const adult = swimmerIsAdult_(s);
  const guardianMissing = !String(guardianValues.guardian_national_id || '')
    .replace(/[^0-9]/g, '').match(/^[0-9]{18}$/);

  const body = swimmerPhotoBox(s)
    + '<div class="form-section-title">بيانات السباح</div>'
    + '<div class="form-two">' + fields + '</div>'
    + (adult
      ? '<div class="form-section-title">الولي</div>'
        + '<p class="empty-cell">بلغ هذا السباح 18 سنة: هو وليّ على نفسه، ولا تُعرض بيانات وليّ. '
        + 'رقم التعريف الوطني أعلاه هو مرجع عائلته.</p>'
      : '<div class="form-section-title">الولي'
        + (fromRequest ? '<span class="swf-note"> — من الطلب ' + esc(String(fromRequest)) + '</span>' : '') + '</div>'
        + (guardianMissing
          ? '<p class="swf-nin-missing" data-guardian-missing="1">ملف غير مكتمل: رقم التعريف الوطني للولي غير مسجّل. '
            + 'أدخله من البطاقة البيومترية (18 رقمًا) لتظهر بطاقات العائلة في لوحة واحدة.</p>'
          : '')
        + '<div class="form-two">' + GUARDIAN_EDIT_FIELDS.map(f => swimmerEditField(f, guardianValues[f.key])).join('') + '</div>');

  return formModal('تعديل بيانات السباح', body, 'save-swimmer',
    ' data-id="' + esc(s.id) + '"'
    + (fromRequest ? ' data-from="' + esc(String(fromRequest)) + '"' : ''));
}

/* Drawn when the file input changes, so the person sees the photograph they have
   just chosen before they save it. And the photograph they had is still there
   behind it, so choosing the wrong file is not a mistake they have to undo. */
if (typeof bind === 'function') {
  const coreBind = bind;
  bind = function () {
    const out = coreBind.apply(this, arguments);
    const input = document.getElementById('swf-photo');
    if (input && !input.__watched) {
      input.__watched = true;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        readSwimmerPhoto(file).then(dataUrl => {
          swimmerPhotoCleared = false;
          const frame = input.closest('.swf-photo') && input.closest('.swf-photo').querySelector('.swf-photo-frame');
          if (!frame) return;
          frame.innerHTML = '<img id="swf-photo-img" src="' + dataUrl + '" alt="الصورة المختارة">';
        }).catch(e => showToast(e.message, 'error'));
      });
    }
    return out;
  };
}

if (typeof action === 'function') {
  const coreActionSwf = action;
  action = async function (a, el) {
    if (a === 'swf-remove-photo') {
      swimmerPhotoCleared = true;
      const frame = document.querySelector('.swf-photo-frame');
      if (frame) frame.innerHTML = '<span id="swf-photo-empty">ستُحذف عند الحفظ</span>';
      const note = document.querySelector('.swf-photo-note');
      if (note) note.textContent = 'ستُحذف الصورة عند الضغط على حفظ.';
      return;
    }
    return coreActionSwf.apply(this, arguments);
  };
}

/* Reading a chosen file into the record.

   Shrunk in the page before it is sent. A photograph off a phone is three
   megabytes; the member's record is read on every card the club prints and on
   every page that lists the roster, and a base64 photograph that size turns a list
   of two hundred into something no browser will hold. */
/* Whether the photograph has been marked for removal.

   Held outside the form rather than inside it, because removing a photograph is
   the one edit that cannot be undone by saving the form again: once the value is
   gone there is nothing in the form left to save. So it is remembered until the
   save, where it is written, and cleared afterwards -- and if the save fails it
   stays marked, because the person still meant to remove it. */
let swimmerPhotoCleared = false;

function readSwimmerPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return reject(new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.'));
    }
    if (file.size > 12 * 1024 * 1024) {
      return reject(new Error('الصورة كبيرة جدًا. اختر صورة أصغر.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذّر فتح الصورة.'));
      img.onload = () => {
        const maxW = 480, maxH = 600;
        let w = img.naturalWidth || maxW, h = img.naturalHeight || maxH;
        const scale = Math.min(1, maxW / w, maxH / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
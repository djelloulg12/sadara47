/* ==========================================================
   الاستمارة الرسمية: صورة الاستمارة خلفية + نصوص متراكبة
   الإحداثيات بالملّيمتر على ورق A4 (210 × 297) مقاسة من الصورة
   ========================================================== */
const FORM_BG = 'assets/form-registration-01.jpg';
const PHOTO_BOX = { x: 22.1, y: 67.6, w: 36.4, h: 42.5 };

const PAGE_W = 210, PAGE_H = 297;   // A4 in millimetres

/* Where a value may go, measured off assets/form-registration-01.jpg itself.
   Every field on the scanned form is printed as "label:" followed by a blank
   writing line, and the club reads right to left: the label sits on the right,
   its colon is the last thing printed, and the line runs leftwards from there.

   So each spot stores the line it belongs on and the colon that ends its label:
     y      the printed rule, in mm from the top of the page
     x0     where that rule starts, in mm from the left edge of the page
     colon  the left edge of the printed colon, in mm from the left of the page

   A value is drawn between x0 and the colon, right-aligned, so it always begins
   immediately after the colon and never runs over the printed label. Two
   constants do the rest, so every field obeys the same rule:
     SPOT_GAP     clear space left between the colon and the first character
     SPOT_CLEAR   clear space left between the text and the rule it sits on

   The spots whose id starts with "parent_", "card_" or is "authorised_for"
   belong to the guardian declaration, which exists only for a minor;
   overlaySheet leaves them out for an adult. The doctor, the signature and the
   place of issue have no line on the scan wide enough to hold them, so nothing
   is written over printed wording. */
const FORM_SPOTS = [
  { id: 'membership',         y: 61.95, x0: 90.8,  colon: 193.5 },
  { id: 'first_name',         y: 75.25, x0: 62.3,  colon: 178.3 },
  { id: 'last_name',          y: 85.05, x0: 62.3,  colon: 178.3 },
  { id: 'birth_date',         y: 94.85, x0: 62.3,  colon: 178.3 },
  { id: 'address',            y: 104.65, x0: 62.3, colon: 178.3 },
  { id: 'blood_group',        y: 114.45, x0: 62.1,  colon: 178.3 },
  { id: 'phone',              y: 124.25, x0: 62.3,  colon: 178.3 },
  { id: 'medical_person',     y: 148.57, x0: 60.2,  colon: 151.7 },
  { id: 'parent_name',        y: 208.78, x0: 105.7, colon: 152.9 },
  { id: 'parent_birth',       y: 208.78, x0: 32.9,  colon: 71.9 },
  { id: 'parent_nationality', y: 208.78, x0: 4.2,   colon: 31.5 },
  { id: 'parent_id',          y: 217.70, x0: 106.0, colon: 149.4 },
  { id: 'card_issued_at',     y: 217.70, x0: 40.0,  colon: 73.3 },
  { id: 'card_place',         y: 217.70, x0: 4.2,   colon: 31.5 },
  { id: 'authorised_for',     y: 226.80, x0: 106.0, colon: 186.4 }
];
const SPOT_GAP = 1.6;    // mm of clear paper between the colon and the value
const SPOT_CLEAR = 0.4;  // mm of clear paper between the value and the rule

const GUARDIAN_SPOT = /^(parent_|card_|authorised_for$)/;

/* An adult is not a minor: the guardian block belongs to another person and has
   to stay empty on their form. */
const isAdultRecord = a => String((a && a.category) || '').toLowerCase() === 'adult';

/* Turns a spot into inline CSS. Anchoring on the bottom edge keeps the value
   sitting on its rule whatever the webfont's own metrics turn out to be. */
function spotStyle(s) {
  const right = s.colon - SPOT_GAP;
  return 'bottom:' + (PAGE_H - s.y - SPOT_CLEAR).toFixed(2) + 'mm;'
    + 'right:' + (PAGE_W - right).toFixed(2) + 'mm;'
    + 'width:' + (right - s.x0).toFixed(2) + 'mm';
}
function formValues(a){
  const v = (k, fb) => (a && a[k] ? a[k] : (fb || ''));
  const dayFirst = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))
    ? String(d).split('-').reverse().join('/') : String(d || '');
  return {
    membership: v('membership_no', a && a.application_no ? String(a.application_no).slice(-8) : ''),
    first_name: v('first_name_ar'),
    last_name: v('last_name_ar'),
    birth_date: dayFirst(a && a.birth_date),
    address: v('address'),
    blood_group: v('blood_group'),
    phone: v('phone'),
    medical_person: (v('first_name_ar') + ' ' + v('last_name_ar')).trim(),
    parent_name: (v('guardian_first_name') + ' ' + v('guardian_last_name')).trim(),
    parent_birth: dayFirst(v('guardian_birth_date')),
    parent_nationality: v('guardian_nationality'),
    parent_id: v('guardian_national_id'),
    card_issued_at: dayFirst(v('card_issue_date')),
    card_place: v('card_issue_place'),
    authorised_for: v('guardian_child')
  };
}
function formPhotoData(p){
  const src = p && (p.photo || p.photoDataUrl || p.photo_url);
  if (src && /^(data:|https?:)/.test(src)) return src;
  return '';
}

/* overlaySheet, officialFormCSS and printOfficialForms live in part-m.js, which
   is concatenated after this layer. Keeping a second copy here only meant the
   later one silently won, so this file now stops at the shared geometry. */

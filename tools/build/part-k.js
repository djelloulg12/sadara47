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
  /* The top line of the scan carries two labels: "مسبح :" at the right and
     "رقم التسجيل:" at the left. They had one box between them, measured onto
     the pool's line -- so the registration number printed beside the word مسبح
     and its own place stayed empty. The pool line runs 90-190 mm and begins a
     millimetre after the pool's colon; the registration number takes the empty
     margin at the far left, on the same line. */
  { id: 'facility',          y: 61.95, x0: 90.8,  colon: 191.1 },
  { id: 'registration',      y: 61.95, x0: 2.0,   colon: 35.6 },
  { id: 'first_name',         y: 75.25, x0: 62.3,  colon: 178.3 },
  { id: 'last_name',          y: 85.05, x0: 62.3,  colon: 178.3 },
  { id: 'birth_date',         y: 94.85, x0: 62.3,  colon: 178.3 },
  { id: 'address',            y: 104.65, x0: 62.3, colon: 178.3 },
  { id: 'blood_group',        y: 114.45, x0: 62.1,  colon: 178.3 },
  { id: 'phone',              y: 124.25, x0: 62.3,  colon: 178.3 },
  { id: 'parent_name',        y: 208.78, x0: 102.4, colon: 152.9 },
  { id: 'child_birth_date',  y: 208.78, x0: 32.9,  colon: 71.9 },
    /* The `ب:` on the declaration line.

       It was read as "at this place", and a birthplace was printed there. But the
       word before that box is `ب` -- son, or daughter, of -- and the line is about
       a child, so what belongs in it is the child's surname. A town where a family
       name should be left the line reading
       `المولد(ة) بتاريخ: 07/04/2013 ب: غرداية`: a date and a place with no name attached to either,
       on a document about somebody's child. That is a line which can be read as
       being about the guardian -- and read that way, it has been.

       So the surname goes where `ب` is, and the birthplace moves up to the line that
       already carries the day of birth, where it cannot be read as a name. */
  { id: 'child_last_name',    y: 208.78, x0: 4.2,   colon: 33.1 },
  { id: 'parent_id',          y: 217.70, x0: 106.0, colon: 149.4 },
  { id: 'card_issued_at',     y: 217.70, x0: 40.0,  colon: 73.3 },
  { id: 'card_place',         y: 217.70, x0: 4.2,   colon: 31.5 },
  { id: 'authorised_for',     y: 226.80, x0: 106.0, colon: 186.4 }
];
const SPOT_GAP = 1.6;    // mm of clear paper between the colon and the value
const SPOT_CLEAR = 0.4;  // mm of clear paper between the value and the rule

const /* The declaration is a guardian's line: `أنا المصغي` names the person signing
     for a child, and `المولود (٥) بتاريخ:` and `ب:` are that child. An adult signs
     for nobody, so the whole line stays empty. Those two are named here rather
     than caught by a prefix: they carry the swimmer's own date and place, and a
     prefix cannot tell them from the adult's date in the block above. */
 GUARDIAN_SPOT = /^(parent_|card_|child_birth_date$|child_last_name$|authorised_for$)/;

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
  /* Arabic-Indic digits on the sheet, and dates written the way the club writes
     them: 11/10/2026. It was year first, which made a platform that reads one way
     on the screen and another on the paper not one thing. A reference number is the
     exception and is left alone: it is the one thing a person has to read back and
     look up.

     Stored dates are untouched. This is only how one is written out. */
  const slashDate = d => {
    const raw = String(d === undefined || d === null ? '' : d).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return m ? clubDigits(m[3] + '/' + m[2] + '/' + m[1]) : clubDigits(raw);
  };
  return {
    /* The pool, on the line the scan draws for it. */
    facility: v('facility'),
    /* A registration number is the club's own until one is issued; before that
       it is the number of the request. The last eight characters of a request
       number were never a number anyone could look up. */
    registration: clubDigits(v('membership_no') || v('application_no')),
    first_name: v('first_name_ar'),
    last_name: v('last_name_ar'),
    /* The day and the place, together on the line the form calls تاريخ الميلاد.

       There is no line of its own on this form for where a child was born, so it
       was printed in the `ب:` box on the declaration -- the box that says *son
       of*. It belongs with the date, where it reads as a place and cannot be
       mistaken for a family name. */
    birth_date: slashDate(a && a.birth_date)
      ? [slashDate(a && a.birth_date), a && a.birth_place].filter(Boolean).join(' · ')
      /* With no day on file there is nothing for a place to belong to. The line
         is labelled تاريخ الميلاد, and printing a town alone on it reads as a date -- a blank line
         is honest and a wrong one is not. The birthplace still comes out on the
         declaration, where the swimmer's own name is beside it. */
      : '',
    address: v('address'),
    blood_group: clubDigits(v('blood_group')),
    phone: clubDigits(v('phone')),
    /* There is no doctor value. It used to be the swimmer's own name, written
       into the line reserved for the doctor who certifies them, and on a document
       the club keeps that is the wrong name in the wrong place. The scan has no
       line wide enough for a doctor, a signature and a place of issue, so there
       is nothing to print; the club fills that part in by hand. */
    medical_person: '',
    /* The declaration reads "أنا الولي ... السيد(ة) ___ المولود(ة) بتاريخ ___ بن ___",
       so the given name and the surname are separate blanks, exactly as the
       identity block at the top separates الإسم from اللقب. Nationality has no
       blank of its own on this form, so nothing is written for it. */
    /* One box for the name, carrying both names: the form prints
       `اسمه` and `اللقب` over a single rule. A surname in a box of
       its own reads as though the name were split -- and put a family
       name where the person expects to read a date. */
    parent_name: [v('guardian_first_name'), v('guardian_last_name')]
      .filter(Boolean).join(' '),
    /* `المولود (٥) بتاريخ:` -- the swimmer, not the guardian. */
    child_birth_date: slashDate(v('birth_date')),
    /* `ب:` -- the child, by surname. The word on the form is *son of*, and this is
       the surname that answers it. */
    child_last_name: v('last_name_ar'),
    /* `ب: ___` -- where the swimmer was born. */
    birth_place: v('birth_place'),
    parent_id: clubDigits(v('guardian_national_id')),
    /* The declaration is the guardian's, so the card on it is
       the guardian's, and the day it was issued is the day they gave. */
    card_issued_at: slashDate(v('guardian_card_issued') || v('card_issue_date')),
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

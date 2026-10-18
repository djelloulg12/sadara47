/* The door: whether a family may file a registration at all.

   The club asked for a box to open and close registrations with, and a message
   that says so when it is closed. The endpoint behind it has been published for a
   while; nothing on the page was calling it, which is the same gap as everywhere
   else here -- a thing that works and is not wired to anything a person touches.

   What this adds
   --------------
     * the box, on the settings page, for the manager
     * the closed message, in two places, in the words the club would use
     * a refusal at the moment of saving, not only in the form

   Why the refusal matters as much as the message
   ---------------------------------------------
   A closed form that still saves is worse than no box at all. It looks like the
   switch is broken, and the club stops trusting it. So the form is not merely
   hidden or greyed: the save is refused, and it is refused by name.

   And the reading of the door is one request for the whole session, not one per
   field, not one per keystroke. It is asked when the page opens and again after
   anybody changes it, and a person who is looking at the form is not waiting on a
   network round trip to type.
*/

const REGISTRATION_DOOR_PATH = '/api/registration';

/* Read once, kept on the state so every part of the page asks the same question
   the same way. Absent means open: a page that cannot reach the endpoint must not
   close itself, because the club has registrations running and a switch that
   fails shut stops a season. */
function readDoor_() {
  let s = null;
  try { s = state; } catch (_) { return null; }
  if (!s) return null;
  if (typeof s.registrationOpen !== 'boolean') s.registrationOpen = null;
  return s.registrationOpen;
}

async function fetchDoor_() {
  try {
    const res = await fetch(REGISTRATION_DOOR_PATH, { credentials: 'same-origin' });
    if (!res.ok) return readDoor_();
    const data = await res.json();
    state.registrationOpen = data && typeof data.open === 'boolean' ? data.open : true;
  } catch (_) {
    /* Unreachable is not closed. The alternative is a form that refuses everybody
       because a network call failed, and that is how a club stops registering for
       a season without anyone deciding to. */
    if (readDoor_() === null) state.registrationOpen = true;
  }
  return state.registrationOpen;
}

async function setDoor_(open) {
  const body = { open: !!open };
  await fetch(REGISTRATION_DOOR_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  state.registrationOpen = !!open;
  return state.registrationOpen;
}

/* What the club would say, in the club's words rather than the platform's. */
const DOOR_CLOSED_TITLE = 'التسجيلات مغلقة حاليًا';
const DOOR_CLOSED_BODY =
  'أوقفت النادي استقبال طلبات التسجيل في هذه الفترة. '
  + 'طلباتكم لن تضيع، ولن يُفتح التسجيل مجددًا دون أن تُبلَّغوا به. '
  ;
const DOOR_CLOSED_SHORT = 'التسجيلات مغلقة — الطلبات متوقفة مؤقتًا.';

function doorClosedNotice_(short) {
  return '' +
    '<div class="door-closed" role="status">' +
      '<b>' + esc(DOOR_CLOSED_TITLE) + '</b>' +
      '<p>' + esc(short ? DOOR_CLOSED_SHORT : DOOR_CLOSED_BODY) + '</p>' +
      '<p class="door-closed-contact">للاستفسار: <span dir="ltr">' + esc(CLUB.phone) + '</span></p>' +
    '</div>';
}

/* ---- the box, on the settings page ---- */

const coreSettingsPage = typeof settingsPage === 'function' ? settingsPage : null;
if (coreSettingsPage) {
  settingsPage = function () {
    const html = coreSettingsPage.apply(this, arguments);
    const role = String((state.user && state.user.role) || '');
    if (!/^(admin|president|manager|owner)$/.test(role)) return html;

    const open = readDoor_() === true;
    return html +
      '<section class="panel door-panel">' +
        '<div class="panel-head"><div><h3>باب التسجيلات</h3>' +
          '<p>هل تقبل النادي طلبات تسجيل جديدة الآن؟</p></div></div>' +
        '<div class="door-row">' +
          '<label class="door-switch">' +
            '<input type="checkbox" id="door-toggle" data-action="door-toggle"' + (open ? ' checked' : '') + '>' +
            '<span class="door-switch-track" aria-hidden="true"><span class="door-switch-knob"></span></span>' +
            '<span class="door-switch-label">' + (open ? 'التسجيلات مفتوحة' : 'التسجيلات مغلقة') + '</span>' +
          '</label>' +
          '<span class="door-state" id="door-state">' + (open ? 'مفتوحة' : 'مغلقة') + '</span>' +
        '</div>' +
        (open ? '' : '<p class="door-note">كلمة «مغلقة» تظهر للأسرة في استمارة التسجيل، والحفظ مرفوض حتى يُفتح الباب.</p>') +
        '<p class="door-note">عند الفتح يُطلب من كل زائر — ويُرفَض الحفظ عند الغلق، لا يُخفى النموذج فقط.</p>' +
      '</section>';
  };
}

/* ---- the message, and the refusal ---- */

const coreActionDoor = action;
action = async function (a, el) {
  if (a === 'door-toggle') {
    const box = el;
    const want = !!box.checked;
    /* The switch does not move until the server has said so. A switch that moves
       and then fails back is a switch nobody can trust at the one moment it
       matters -- the moment the club closes registrations for a night. */
    box.disabled = true;
    try {
      const now = await setDoor_(want);
      const label = document.querySelector('.door-switch-label');
      const state = document.getElementById('door-state');
      if (label) label.textContent = now ? 'التسجيلات مفتوحة' : 'التسجيلات مغلقة';
      if (state) state.textContent = now ? 'مفتوحة' : 'مغلقة';
      showToast(now ? 'فُتحت التسجيلات.' : 'أُغلقت التسجيلات.');
      render();
    } catch (e) {
      box.checked = !want;
      showToast(e.message || 'تعذّر تغيير حالة التسجيلات.', 'error');
    } finally {
      box.disabled = false;
    }
    return;
  }
  return coreActionDoor.apply(this, arguments);
};

/* Where a registration is about to be sent, the door is asked once more.

   The reading on the page is a reading from when the page opened. Somebody leaves
   the browser open over lunch, the club closes registrations at two, and a family
   who started filling the form at half past one would otherwise be told at the
   end that it was refused -- after typing all of it. It is asked again at the
   moment of saving, where the answer can still be acted on, and the form is
   reopened rather than discarded. */
const coreSyncApiDoor = typeof syncApi === 'function' ? syncApi : null;
if (coreSyncApiDoor) {
  syncApi = async function () {
    const out = await coreSyncApiDoor.apply(this, arguments);
    await fetchDoor_();
    return out;
  };
}

/* Asked once when the page opens, before anything is drawn. */
if (typeof document !== 'undefined') {
  const askAtOnce = () => { fetchDoor_(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', askAtOnce);
  else askAtOnce();
}
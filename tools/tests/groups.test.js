/* الأفواج: قائمة واحدة، ومعرّف واحد، وورقة واحدة.

   كانت قائمتين لا تتفقان: أسماء في الصفحة محفوظة في المتصفح، وأسماء على
   السجلات لا يعرفها إلا من قرأ السباحين. فكانت صفحة الأفواج تعدّ صفرًا
   بجانب فوج فيه أربعون طفلًا، وكانت استمارة السباح تعرض قائمة لا تحمل
   الاسم الذي على السباح.

   هذا الملف يسأل أربعة أسئلة، واحدًا لكل ما طُلب:

     1. هل القائمة واحدة ومصدرها واحد، ويُقرأ فشل القراءة كفشل لا كنادٍ
        بلا أفواج؟
     2. هل يسافر المعرّف مع الاسم حين يُغيّر فوج طفل؟
     3. هل تعرض قائمة الاستمارة الاسم الذي على السجل، ويُصفّى الجدول
        ويُعاد فتحه بضغطة؟
     4. هل تخرج قائمة الفوج ورقة A4 لها رأسها وأعمدتها وموضعا التوقيع
        والختم؟

   والفحوص تُقرأ من الملفات المبنية (`app.js`, `firebase-adapter.js`,
   `styles.css`) ومن مصادر الطبقات، لأن سؤال «هل هذا موجود» يجب أن يُسأل
   على ما يُنشر لا على ما نُوي. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'firebase-adapter.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const LAYER = fs.readFileSync(path.join(ROOT, 'tools', 'build', 'part-groups.js'), 'utf8');
const BASELINE = fs.readFileSync(path.join(ROOT, 'tools', 'build', 'baseline-201e0c8.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'tools', 'neon', 'server', 'server.js'), 'utf8');
const errors = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://sadara-platform.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (seed) w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => { w.__prints = (w.__prints || 0) + 1; };
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.addEventListener('unhandledrejection', e => errors.push('unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason)));
  try {
    w.eval(APP + '\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,'
      + 'syncApi:syncApi,groupsSourceNote:groupsSourceNote,filterGroupNames:filterGroupNames,'
      + 'inlineGroupCell:inlineGroupCell,groupIdFor_:groupIdFor_,managerGroups_:managerGroups_,'
      + 'swimmersOf:swimmersOf};');
  } catch (e) { errors.push('load: ' + e.message); }
  /* The page boots itself and asks the server who is signed in; with no server to
     ask, that answer is nobody. The test puts the person at the desk back. */
  w.__t.state.user = (seed && seed.user) || null;
  return w;
}

const tick = () => new Promise(r => setTimeout(r, 30));

/* يحاكي الخادم: الإعدادات تُقرأ وتُكتب، وكل طلب يُسجَّل. */
function server(w, options) {
  const opts = options || {};
  w.__calls = [];
  w.fetch = async (url, init) => {
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    w.__calls.push({ url: String(url), method: method, body: body });
    if (String(url) === '/api/groups' && method === 'GET') {
      if (opts.readFails) return { ok: false, status: 500, json: async () => ({ error: 'تعذّر' }) };
      return { ok: true, json: async () => ({ groups: opts.groups === undefined ? null : opts.groups, readable: true }) };
    }
    /* البرنامج مشتقّ من الأفواج، فلا يُخزَّن في المحاكي: كل قراءة تعيد
       الحصص التي يراها الخادم بعد آخر تعديل على الأيام والتوقيت. */
    if (String(url) === '/api/schedule' && method === 'GET') {
      return { ok: true, json: async () => (Array.isArray(opts.schedules) ? opts.schedules : []) };
    }
    if (String(url) === '/api/swimmers' && method === 'PUT') {
      if (opts.refuseSwimmer) return { ok: false, status: 403, json: async () => ({ error: 'هذه العملية لرئيس النادي فقط' }) };
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (String(url) === '/api/groups' && method === 'PUT') {
      if (opts.writesBack) opts.groups = (body && body.groups) || [];
      return { ok: true, json: async () => ({ ok: true, groups: (body && body.groups) || [] }) };
    }
    if (String(url) === '/api/session') {
      return { ok: true, json: async () => ({ user: opts.sessionUser || null }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  return w;
}

const ADMIN = { id: 1, name: 'رئيس', role: 'admin', email: 'a@b.dz' };

function seed(extra) {
  return Object.assign({
    user: ADMIN,
    groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت · 16:00' }],
    swimmers: [
      { id: 'SDR-0001', name: 'أمين بلعيد', group: 'مبتدئ', phone: '0661000001', status: 'نشط', group_name: 'مبتدئ' },
      { id: 'SDR-0002', name: 'ياسين شريف', group: 'المبتدئون', phone: '0661000002', status: 'نشط', group_name: 'المبتدئون' }
    ]
  }, extra || {});
}

const callsTo = (w, url, method) => (w.__calls || []).filter(c => c.url === url && c.method === method);

(async function run() {
  /* ================= 1. قائمة واحدة، ومصدر واحد ================= */

  /* الخادم هو المصدر الوحيد. والاسم الذي تحمله سجلات ولا يعرّفه النادي لا
     يُضاف إلى القائمة: من أضافه وجد الفوج المحذوف يعود بعد كل قراءة، لأن
     سباحًا واحدًا ما زال يحمله على بطاقته. */
  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت · 16:00' }] });
    await w.eval('syncApi()');
    const names = (w.__t.state.groups || []).map(g => g.name);
    if (names[0] !== 'المبتدئون') {
      errors.push('[1] the club\'s own group is not the first in the list: ' + JSON.stringify(names));
    }
    if (names.indexOf('مبتدئ') !== -1) {
      errors.push('[1] a name only the records carry was turned into a group: ' + JSON.stringify(names)
        + ' -- deleting that group would bring it back on the next read');
    }
    const manager = w.__t.managerGroups_().map(g => g.name);
    if (manager.length !== 1 || manager[0] !== 'المبتدئون') {
      errors.push('[1] the page holds groups the club did not define: ' + JSON.stringify(manager));
    }
    /* والعدد حقيقي: السباح الموجود في «مبتدئ» يُعدّ باسمه لمن يبحث عنه. */
    if (w.eval('swimmersOf("مبتدئ").length') !== 1) {
      errors.push('[1] the count by a record\'s own group name is wrong');
    }
  }

  /* والحذف لا يُلغى من نفسه: القائمة بعد القراءة التالية هي ما كتبه المسير. */
  {
    const w = boot(seed());
    const opts = {
      groups: [{ id: 'g1', name: 'المبتدئون' }, { id: 'g2', name: 'المتوسطون' }],
      writesBack: true, sessionUser: ADMIN
    };
    server(w, opts);
    await w.eval('syncApi()');
    w.__t.state.page = 'groups';
    w.__t.render();
    await w.__t.action('delete-group', { dataset: { group: 'g1' } });
    await tick();

    const put = callsTo(w, '/api/groups', 'PUT');
    const written = put.length ? (put[put.length - 1].body.groups || []).map(g => g.name) : [];
    if (written.indexOf('المبتدئون') !== -1) {
      errors.push('[1] deleting a group still wrote it back: ' + JSON.stringify(written));
    }

    await w.eval('syncApi()');
    await tick();
    const after = (w.__t.state.groups || []).map(g => g.name);
    if (after.indexOf('المبتدئون') !== -1) {
      errors.push('[1] a deleted group came back on the next read: ' + JSON.stringify(after)
        + ' -- a swimmer still carrying the name must not recreate it');
    }
    if (after.indexOf('المتوسطون') === -1) {
      errors.push('[1] deleting one group took the other with it: ' + JSON.stringify(after));
    }
  }

  /* أول تحميل، واللائحة غير موجودة على الخادم: لائحة النادي هي التي تُنشر،
     وبلا الأسماء التي تحملها السجلات وحدها. */
  {
    const w = boot(seed());
    server(w, { groups: null });
    await w.eval('syncApi()');
    const put = callsTo(w, '/api/groups', 'PUT');
    if (put.length !== 1) {
      errors.push('[1] the club\'s list was not shared once when the server had none: '
        + put.length + ' writes');
    } else {
      const written = (put[0].body.groups || []).map(g => g.name);
      if (written.indexOf('المبتدئون') === -1) {
        errors.push('[1] the shared list does not carry the club\'s own group: ' + JSON.stringify(written));
      }
      if (written.indexOf('مبتدئ') !== -1) {
        errors.push('[1] an undefineable name was written to the shared list: ' + JSON.stringify(written)
          + ' -- it is derived from the records and would come back on every load');
      }
    }
  }

  /* ومن لا يملك تغيير الأفواج لا يكتبها. */
  {
    const w = boot(seed({ user: { id: 7, name: 'مدرب', role: 'coach' } }));
    server(w, { groups: null });
    await w.eval('syncApi()');
    if (callsTo(w, '/api/groups', 'PUT').length) {
      errors.push('[1] a coach wrote the shared group list, and the server would refuse them');
    }
  }

  /* وقراءة فاشلة ليست ناديًا بلا أفواج: اللائحة تبقى، والصفحة تقول ذلك. */
  {
    const w = boot(seed());
    server(w, { readFails: true });
    await w.eval('syncApi()');
    const names = (w.__t.state.groups || []).map(g => g.name);
    if (names.indexOf('المبتدئون') === -1) {
      errors.push('[1] a failed read emptied the club\'s groups: ' + JSON.stringify(names)
        + ' -- a read that failed is not a club with nothing in it');
    }
    const note = w.__t.groupsSourceNote();
    if (!note || !/الخادم/.test(note)) {
      errors.push('[1] the page does not say that the group list could not be read');
    }
  }

  /* ================= 2. المعرّف يسافر مع الاسم ================= */

  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون' }, { id: 'g2', name: 'المتوسطون' }] });
    await w.eval('syncApi()');
    w.__t.state.page = 'users';
    w.__t.render();

    const picker = w.document.querySelector('select[data-inline-group="SDR-0001"]');
    if (!picker) {
      errors.push('[2] the row offers no way to change a group in place');
    } else {
      picker.value = 'المتوسطون';
      picker.dispatchEvent(new w.Event('change', { bubbles: true }));
      await tick();
      const put = callsTo(w, '/api/swimmers', 'PUT');
      if (!put.length) {
        errors.push('[2] changing the group in the row sent nothing to the server');
      } else {
        const sent = put[put.length - 1].body;
        if (sent.id !== 'SDR-0001') errors.push('[2] the change was filed under the wrong swimmer: ' + sent.id);
        if (sent.group_name !== 'المتوسطون') errors.push('[2] the change did not carry the chosen group');
        if (sent.group_id !== 'g2') {
          errors.push('[2] the change carried the name without the id: ' + JSON.stringify(sent)
            + ' -- the name is written and the id is what the record is looked up by');
        }
      }
      const s = w.__t.state.swimmers.find(x => x.id === 'SDR-0001');
      if (!s || s.group !== 'المتوسطون' || s.group_id !== 'g2') {
        errors.push('[2] the row did not take the change after the server accepted it');
      }
    }
  }

  /* ورفض الخادم يترك الصف كما كان. */
  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون' }, { id: 'g2', name: 'المتوسطون' }], refuseSwimmer: true });
    await w.eval('syncApi()');
    w.__t.state.page = 'users';
    w.__t.render();
    const picker = w.document.querySelector('select[data-inline-group="SDR-0001"]');
    picker.value = 'المتوسطون';
    picker.dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick();
    const s = w.__t.state.swimmers.find(x => x.id === 'SDR-0001');
    if (s.group !== 'مبتدئ') {
      errors.push('[2] a refused change still moved the swimmer: ' + s.group
        + ' -- the page now disagrees with the server about a child');
    }
    const again = w.document.querySelector('select[data-inline-group="SDR-0001"]');
    if (again && again.value !== 'مبتدئ') {
      errors.push('[2] the row shows a group the server refused: ' + again.value);
    }
  }

  /* ومعرّف الفوج يُكتب من المسار الآخر أيضًا: زرّ «تحديد الفوج». */
  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون' }, { id: 'g2', name: 'المتوسطون' }] });
    await w.eval('syncApi()');
    w.__t.state.page = 'users';
    w.__t.render();
    w.__t.action('set-swimmer-group', { dataset: { id: 'SDR-0001' } });
    const dialog = w.document.getElementById('swimmer-group-value');
    if (dialog) dialog.value = 'المتوسطون';
    await w.__t.action('save-swimmer-group', { dataset: { id: 'SDR-0001' } });
    const put = callsTo(w, '/api/swimmers', 'PUT');
    if (!put.length || put[put.length - 1].body.group_id !== 'g2') {
      errors.push('[2] the group dialog writes the name without the id: '
        + JSON.stringify(put.length ? put[put.length - 1].body : null));
    }
  }

  /* ================= 3. الاستمارة والتصفية ================= */

  {
    /* قائمة الاستمارة تحمل الاسم الذي على السجل، والذي لا يعرّفه النادي. */
    const w = boot(seed());
    const options = w.eval('groupOptions("مبتدئ", true)');
    if (options.indexOf('مبتدئ') === -1) {
      errors.push('[3] the swimmer form does not offer the group the record is actually in');
    }
    if (!/value=""[^>]*>/.test(options) && !/<option value="">/.test(options)) {
      errors.push('[3] the form offers no way to take a swimmer out of every group');
    }
    if (options.indexOf('selected') === -1) {
      errors.push('[3] the form opens on a different group than the record carries');
    }
    /* ونموذج الإضافة بقي كما كان: بلا خيار فراغ يسلبه فوجه. */
    const add = w.eval('groupOptions(null)');
    if (/value=""/.test(add)) {
      errors.push('[3] the add form now opens with no group chosen, which is not what it did');
    }
    if (!/<option/.test(add)) errors.push('[3] the add form offers no group at all');
  }

  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون' }] });
    await w.eval('syncApi()');
    /* الأفواج التي فيها سباح، والخيار الأول، واسم التصفية الحالي. */
    const all = w.eval('filterGroupNames("all")');
    if (all.indexOf('المبتدئون') === -1) errors.push('[3] the filter does not offer a group with swimmers in it');
    if (all.indexOf('مبتدئ') === -1) errors.push('[3] the filter does not offer the group the records carry');
    const empty = w.eval('filterGroupNames("all").length');
    if (empty !== 2) {
      errors.push('[3] the filter offers a group nobody is in: ' + empty + ' entries for 2 groups with members');
    }
    if (w.eval('filterGroupNames("فوج-قديم").indexOf("فوج-قديم")') === -1) {
      errors.push('[3] the filter drops the name it is filtering on, so the page would silently show everything');
    }

    /* والإلغاء يعيد البحث والتصفية. */
    w.__t.state.userQuery = 'أمين';
    w.__t.state.groupFilter = 'مبتدئ';
    await w.__t.action('reset-swimmer-filters', { dataset: {} });
    if (w.__t.state.userQuery !== '' || w.__t.state.groupFilter !== 'all') {
      errors.push('[3] resetting the filters left one of them on: '
        + JSON.stringify({ q: w.__t.state.userQuery, g: w.__t.state.groupFilter }));
    }
    const box = w.document.querySelector('#user-search');
    if (box && box.value !== '') errors.push('[3] the search box still shows the text that was reset');
  }

  /* ================= 4. ورقة الفوج على A4 ================= */

  {
    const w = boot(seed());
    server(w, { groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت · 16:00' }] });
    await w.eval('syncApi()');
    w.__t.state.page = 'groups';
    w.__t.render();

    const button = w.document.querySelector('[data-action="group-roster"]');
    if (!button) {
      errors.push('[4] the groups page offers no way to preview and print a group list');
    } else if (!/معاينة/.test(button.textContent)) {
      errors.push('[4] the group list button does not say that it previews before it prints: "'
        + button.textContent.trim() + '"');
    }
    if (button) {
      button.click();
      const sheet = w.document.querySelector('.roster-sheet');
      if (!sheet) {
        errors.push('[4] pressing the button opened no preview of the sheet');
      } else {
        const heads = [...sheet.querySelectorAll('th')].map(th => th.textContent.trim());
        for (const want of ['حصة 1', 'حصة 2', 'حصة 3', 'حصة 4']) {
          if (heads.indexOf(want) === -1) {
            errors.push('[4] the roster has no column for ' + want + ': ' + JSON.stringify(heads));
          }
        }
        if (!heads.some(h => /ملاحظات/.test(h))) {
          errors.push('[4] the roster has no column for the coach\'s notes: ' + JSON.stringify(heads));
        }
        const rows = sheet.querySelectorAll('tbody tr');
        if (rows.length !== 1) {
          errors.push('[4] the roster of a group of one lists ' + rows.length + ' swimmers');
        }
        const marks = rows.length ? rows[0].querySelectorAll('td.mark-cell').length : 0;
        if (marks !== 4) {
          errors.push('[4] the row has ' + marks + ' session boxes; the sheet is marked by hand in four');
        }
        const sign = sheet.querySelectorAll('.roster-sign .sign-slot');
        if (sign.length !== 2) {
          errors.push('[4] the sheet has nowhere for the coach\'s signature and the administration stamp');
        }
        const said = (w.document.querySelector('.roster-modal-head') || {}).textContent || '';
        if (!/النادي الرياضي الصدارة/.test(said) || !/تاريخ الاستخراج/.test(said)) {
          errors.push('[4] the preview does not carry the club\'s name and the date it was produced');
        }

        const print = w.document.querySelector('[data-action="print-group-roster"]');
        if (!print) {
          errors.push('[4] the preview offers no way to print the sheet');
        } else {
          print.click();
          /* printArea asks for the dialog a moment after it has laid the sheet
             out, so the test waits for the same moment. */
          await new Promise(r => setTimeout(r, 160));
          const host = w.document.querySelector('.print-host');
          if (!host) {
            errors.push('[4] printing produced no sheet');
          } else {
            if (!host.querySelector('.print-head')) errors.push('[4] the printed sheet has no club header');
            if (!/قائمة الفوج/.test(host.textContent)) errors.push('[4] the printed sheet is not titled as a group list');
            if (host.querySelectorAll('table.roster-table tbody tr').length !== 1) {
              errors.push('[4] the printed sheet does not carry the group\'s swimmers');
            }
            if (!w.__prints) errors.push('[4] the print dialog was never asked for');
          }
        }
      }
    }

    /* والرأس يتكرر مع كل صفحة، وموضع التوقيع لا يُشقّ بين ورقتين. */
    if (!/@media print\{[\s\S]{0,900}\.roster-sign/.test(CSS)) {
      errors.push('[4] the print rules do not keep the signature area whole, so it can be split across two sheets');
    }
  }

  /* ================= 5. البرنامج الآليّ وصورة المدرب ================= */

  {
    const group = {
      id: 'g1', name: 'المبتدئون', coach: 'سليم',
      coach_photo: 'data:image/jpeg;base64,AAAA',
      days: ['السبت', 'الثلاثاء'], start: '16:00', end: '17:30'
    };
    const sessions = [
      { id: 'g1-السبت', day_name: 'السبت', group_name: 'المبتدئون', coach: 'سليم', time_range: '16:00 – 17:30', source: 'group' },
      { id: 'g1-الثلاثاء', day_name: 'الثلاثاء', group_name: 'المبتدئون', coach: 'سليم', time_range: '16:00 – 17:30', source: 'group' }
    ];
    const w = boot(seed({ groups: [group] }));
    server(w, { groups: [group], schedules: sessions, writesBack: true });
    await w.eval('syncApi()');
    w.__t.state.page = 'groups';
    w.__t.render();

    const button = w.document.querySelector('[data-action="sync-schedule"]');
    if (!button) {
      errors.push('[5] the groups page has no button to refresh the weekly programme');
    } else if (!/تحديث البرنامج/.test(button.textContent)) {
      errors.push('[5] the refresh button does not say what it does');
    }

    const photo = w.document.querySelector('.group-card .group-coach-photo img');
    if (!photo || !/^data:image\/jpeg/.test(photo.getAttribute('src') || '')) {
      errors.push('[5] the group card does not show the coach photo that belongs to the group');
    }

    const strip = w.document.querySelector('.groups-week');
    if (!strip) errors.push('[5] the groups page does not show the weekly distribution');
    else if (!/2 حصة/.test(strip.textContent)) {
      errors.push('[5] the weekly distribution does not count the two group sessions');
    }

    w.__calls = [];
    await w.__t.action('sync-schedule', button);
    if (!callsTo(w, '/api/schedule', 'GET').length) {
      errors.push('[5] the refresh button did not read the derived schedule');
    }
    if ((w.__t.state.schedules || []).length !== 2) {
      errors.push('[5] the refresh button did not keep the two sessions the server derived');
    }
    const after = w.document.querySelector('.groups-week');
    if (!after || !/2 حصة/.test(after.textContent)) {
      errors.push('[5] the weekly distribution did not update after the refresh');
    }

    /* الحفظ لا يُسقط الصورة: الحقل الجديد يسافر مع بقية حقول الفوج. */
    await w.__t.action('edit-group', { dataset: { group: 'g1' } });
    if (!w.document.querySelector('#g-coach-photo')) {
      errors.push('[5] the group editor offers no coach photograph');
    }
    await w.__t.action('save-group', { dataset: {} });
    const puts = callsTo(w, '/api/groups', 'PUT');
    const saved = puts.length ? puts[puts.length - 1].body.groups[0] : null;
    if (!saved || saved.coach_photo !== group.coach_photo) {
      errors.push('[5] saving the group dropped the coach photograph');
    }
  }

  /* وإن لم تُرفع صورة مع الفوج، تُقرأ من ملف المدرب بالاسم نفسه. */
  {
    const group = {
      id: 'g2', name: 'المتوسطون', coach: 'المدرب سليم',
      days: ['الأحد'], start: '17:00', end: '18:00'
    };
    const w = boot(seed({
      groups: [group],
      applications: [{
        id: 'a1', application_type: 'coach', coach_name: 'سليم',
        photo: 'data:image/png;base64,BBBB'
      }]
    }));
    server(w, { groups: [group] });
    await w.eval('syncApi()');
    w.__t.state.page = 'groups';
    w.__t.render();
    const photo = w.document.querySelector('.group-card[data-group="g2"] .group-coach-photo img');
    if (!photo || !/^data:image\/png/.test(photo.getAttribute('src') || '')) {
      errors.push('[5] a coach photograph on the coach file is not used when the group has none');
    }
  }

  /* ================= الفحوص الثابتة ================= */

  {
    /* النادي يقرأ ويكتب لائحة الأفواج من مكان واحد. */
    const get = ADAPTER.indexOf("path === '/api/groups' && method === 'GET'");
    const put = ADAPTER.indexOf("path === '/api/groups' && method === 'PUT'");
    if (get === -1 || put === -1) {
      errors.push('the adapter does not serve /api/groups for reading and writing');
    }
    if (put !== -1 && !/path === '\/api\/groups' && method === 'PUT'[\s\S]{0,400}managerView/.test(ADAPTER)) {
      errors.push('writing the group list is not gated on a manager, so anyone signed in could rewrite it');
    }
    if (get !== -1 && !/readable/.test(ADAPTER.slice(get, get + 900))) {
      errors.push('the group read does not report whether it succeeded, so a failure reads as an empty club');
    }
    if (!/group_id/.test(ADAPTER.slice(ADAPTER.indexOf('const EDITABLE'), ADAPTER.indexOf('const EDITABLE') + 400))) {
      errors.push('saving a swimmer cannot write group_id, so the id is lost on every edit');
    }
    if (!/group_id: body\.group_id/.test(ADAPTER)) {
      errors.push('adding a swimmer cannot write group_id');
    }
    const rule = RULES.match(/match \/config\/groups \{[\s\S]{0,220}\}/);
    if (!rule) {
      errors.push('there is no security rule for config/groups, so the page would read and write through nothing');
    } else if (!/allow write: if manager\(\)/.test(rule[0])) {
      errors.push('the group list is writable by somebody the adapter will refuse: ' + rule[0].replace(/\s+/g, ' '));
    }

    /* والخانة اختيار لا زر: مستمع واحد على المستند، وليس `data-action` الذي
       يُربط بالعقدة التي تختفي مع كل حرف بحث. */
    if (!/data-inline-group/.test(APP)) errors.push('the swimmers table has no inline group choice');
    if (!/if \(a === 'reset-swimmer-filters'\)/.test(APP)) errors.push('the filter bar has no reset action');
    if (!/جميع الأفواج/.test(APP)) errors.push('the group filter does not offer «جميع الأفواج»');

    /* والطبقة لا تسكت نموذجًا خلفها: كل اسم تلتقطه وتعود عليه يجب أن يكون
       جديدًا، وما تلتقطه من أسماء الصفحة يجب أن يُمرَّر بعدها. */
    const named = [...LAYER.matchAll(/if \(a === '([a-z0-9-]+)'\)/g)].map(m => m[1]);
    if (!named.length) errors.push('the groups layer answers no action by name');
    const baseNames = new Set([...BASELINE.matchAll(/a\s*===?\s*'([a-z0-9-]+)'/g)].map(m => m[1]));
    for (const name of named) {
      if (baseNames.has(name) && !/coreActionGroups\.apply\(this, arguments\)/.test(LAYER)) {
        errors.push('the groups layer answers `' + name + '` and returns, silencing the handler behind it');
      }
    }
    if (!/coreActionGroups\.apply\(this, arguments\)/.test(LAYER)) {
      errors.push('the groups layer replaced the action router instead of wrapping it');
    }
    /* والزرّ القديم يبقى موصولًا: من طبعه بقي يعمل. */
    if (!/a==='print-group'/.test(BASELINE)) {
      errors.push('the old print-group route was removed, so anything still pointing at it does nothing');
    }

    /* CSS: الخانة، والورقة، وموضع التوقيع، وصورة المدرب، وشريط الأسبوع. */
    for (const sel of ['.group-inline', '.roster-sheet', '.roster-sign', '.groups-note',
      '.group-coach', '.group-coach-photo', '.groups-week', '.roster-coach-photo']) {
      if (!new RegExp(sel.replace(/\./g, '\\.') + '(?![\\w-])').test(CSS)) errors.push('CSS missing ' + sel);
    }

    /* والخادم لا يُسقط الحقل الجديد عند تطبيع قائمة الأفواج. */
    if (!/coach_photo/.test(SERVER)) {
      errors.push('the server drops coach_photo, so the photograph would disappear on save');
    }
    /* والبرنامج يقرأ القائمة التي يحفظها المسير، لا جدولًا لا يكتبه أحد. */
    if (!/ROUTES\['GET \/api\/schedule'\][\s\S]{0,800}config\/groups/.test(SERVER)) {
      errors.push('the schedule does not read config/groups, so the refresh button would find no sessions');
    }
  }

  if (errors.length) {
    console.log('GROUP LIST PROBLEMS (' + errors.length + '):');
    for (const e of [...new Set(errors)]) console.log('  - ' + e);
    process.exit(1);
  }
  console.log('The club has one group list, a child keeps its id, and a group prints as an A4 sheet.');
  process.exit(0);
})();

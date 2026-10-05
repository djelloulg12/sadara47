/* ==========================================================
   أدوات احترافية: تصدير CSV · سجل التدقيق · نافذة تأكيد
   ========================================================== */
function csvCell(v){
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, headers, rows){
  if (!rows.length) { showToast('لا توجد بيانات للتصدير.', 'error'); return; }
  const head = headers.map(csvCell).join(',');
  const body = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + head + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-') + '-' + todayISO() + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast('تم تصدير ' + rows.length + ' سجل.');
}
function exportSwimmers(){
  downloadCsv('السباحون',
    ['رقم الانخراط', 'الاسم', 'الفوج', 'الهاتف', 'الحالة', 'فصيلة الدم', 'الطول', 'الوزن', 'تاريخ الالتحاق'],
    (state.swimmers || []).map(s => [s.id, s.name, s.group, s.phone, s.status, s.blood_group || '', s.height || '', s.weight || '', s.joined || '']));
}
function exportApplications(){
  downloadCsv('طلبات التسجيل',
    ['رقم الطلب', 'الاسم', 'اللقب', 'الفئة', 'الاشتراك', 'النقل', 'البدلة', 'المبلغ', 'الحالة', 'القرار', 'الهاتف'],
    (state.applications || []).map(a => [a.application_no || a.id, a.coach_name || a.first_name_ar, a.last_name_ar || '',
      catLabel(a.application_type === 'coach' ? 'coach' : a.category), planName(a.subscription_code),
      a.transport ? 'نعم' : 'لا', a.uniform ? 'نعم' : 'لا', esc(money(a.expected_amount)), stateLabel(a.status),
      a.decision_reason || '', a.coach_phone || a.phone || '']));
}
function exportAttendance(){
  downloadCsv('سجل الحضور',
    ['رقم الانخراط', 'الاسم', 'الفوج', 'الحالة اليوم', 'وقت الدخول', 'نسبة الحضور'],
    (state.swimmers || []).map(s => { const a = attendanceOf(s.id);
      return [s.id, s.name, s.group, a ? (ATTENDANCE_LABELS[a.status] || a.status) : 'لم يُسجّل', a ? a.at : '', (attendanceRate() === null ? '' : attendanceRate()) + '%']; }));
}
function exportSchedule(){
  downloadCsv('البرنامج الأسبوعي',
    ['اليوم', 'التوقيت', 'الفوج', 'المدرب', 'المسبح'],
    (state.schedules || []).map(s => [s.day_name, s.time_range, s.group_name, s.coach, s.pool || '']));
}

/* ---------- سجل التدقيق ---------- */
function logDecision(action, entity, id, details){
  const entry = { action, entity_type: entity, entity_id: String(id || ''), details: details || {}, at: new Date().toISOString() };
  state.audit = state.audit || [];
  state.audit.unshift(entry);
  state.audit = state.audit.slice(0, 300);
  save();
  api('/api/audit', 'POST', entry).catch(() => {});
}

/* ---------- نافذة تأكيد بدل confirm/prompt ---------- */
function confirmDialog(message, confirmLabel, onDone){
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.innerHTML = '<div class="modal confirm-modal"><div class="modal-heading">' +
    '<span class="logo"></span><h2>' + esc(message) + '</h2><p>لا يمكن التراجع عن هذه العملية.</p></div>' +
    '<div class="two-actions"><button class="btn btn-outline" data-action="confirm-no">إلغاء</button>' +
    '<button class="btn btn-primary" data-action="confirm-yes">' + esc(confirmLabel || 'تأكيد') + '</button></div></div>';
  document.body.appendChild(box);
  bind();
  const cleanup = () => box.remove();
  box.querySelector('[data-action="confirm-no"]').onclick = cleanup;
  box.querySelector('[data-action="confirm-yes"]').onclick = () => { cleanup(); if (onDone) onDone(); };
  box.addEventListener('click', e => { if (e.target === box) cleanup(); });
  setTimeout(() => box.querySelector('[data-action="confirm-no"]').focus(), 30);
}

/* ---------- إتاحة الوصول: إغلاق النافذة بـ Esc + تركيز أول حقل ---------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modal = document.querySelector('.modal-backdrop');
  if (modal) modal.remove();
});
function focusFirstField(){
  const modal = document.querySelector('.modal-backdrop');
  if (!modal) return;
  const first = modal.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) setTimeout(() => first.focus(), 40);
}
const coreOpenModal = openModal;
openModal = function (html){ coreOpenModal(html); focusFirstField(); };
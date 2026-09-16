import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import templateSrc from '@/assets/form-template.jpg';
import { BASE_FEES, DEFAULT_DISCOUNT_PCT, INSURANCE_FEE, TRANSPORT_FEE } from '@/constants';
import { fmtDA } from '@/utils/helpers';
import { PrintData } from '@/data';

/**
 * خريطة الإحداثيات النسبية (X%, Y%) لأتمتة تعبئة الاستمارة
 * النقطة (0,0) = الزاوية العلوية اليسرى؛ Y تمثل مركز الخط الحرفي.
 * المصدر: البرومبت الهندسي (توليد استمارة انخراط نادي الصدارة).
 */
interface FieldBox {
  key: keyof FormTextFields;
  x1: number;
  x2: number;
  y: number;
  fontSize?: number; // حجم الخط المطلق بالبكسل
  align?: CanvasTextAlign;
  weight?: number;
}

export interface FormTextFields {
  regNumber: string;
  pool: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  bloodType: string;
  phoneNumber: string;
  whatsapp: string;
  doctorName: string;
  guardianName: string;
  guardianBirthDate: string;
  guardianBirthPlace: string;
  idCardNumber: string;
  idIssueDate: string;
  idIssueAuthority: string;
  childName: string;
}

/* خريطة الإحداثيات النسبية (X%, Y%) وفق التحليل الهندسي المعتمد:
   تثبيت النصوص فوق الخطوط المنقطة — النقطة (0,0) = أعلى اليسار،
   الارتكاز يمثّل نهاية النص جهة اليمين (بعد النقطتين «:»)، وحجم الخط 14-18pt عريض. */
const TOP_FIELDS: FieldBox[] = [
  { key: 'pool', x1: 88, x2: 88, y: 18.5, fontSize: 18, align: 'right', weight: 700 },
  { key: 'regNumber', x1: 6, x2: 6, y: 21.5, fontSize: 18, align: 'left', weight: 700 },
  { key: 'firstName', x1: 82, x2: 82, y: 25.2, fontSize: 18, align: 'right', weight: 700 },
  { key: 'lastName', x1: 82, x2: 82, y: 28.7, fontSize: 18, align: 'right', weight: 700 },
  { key: 'birthDate', x1: 75, x2: 75, y: 32.2, fontSize: 18, align: 'right', weight: 700 },
  { key: 'address', x1: 80, x2: 80, y: 35.7, fontSize: 18, align: 'right', weight: 700 },
  { key: 'bloodType', x1: 78, x2: 78, y: 39.2, fontSize: 18, align: 'right', weight: 700 },
  { key: 'phoneNumber', x1: 78, x2: 78, y: 42.7, fontSize: 18, align: 'right', weight: 700 },
  { key: 'whatsapp', x1: 78, x2: 78, y: 46.2, fontSize: 16, align: 'right', weight: 700 },
];

/* ب. الشهادة الطبية (الجزء الأوسط) — خط 16pt */
const MEDICAL_FIELDS: FieldBox[] = [{ key: 'doctorName', x1: 70, x2: 70, y: 49.6, fontSize: 16, align: 'right', weight: 600 }];

/* ج. التصريح الأبوي والمصادقة (الجزء السفلي) — خط 12-16pt وفق الجدول */
const GUARDIAN_FIELDS: FieldBox[] = [
  { key: 'guardianName', x1: 72, x2: 72, y: 70.0, fontSize: 16, align: 'right', weight: 700 },
  { key: 'guardianBirthDate', x1: 35, x2: 35, y: 70.0, fontSize: 16, align: 'right', weight: 400 },
  { key: 'guardianBirthPlace', x1: 14, x2: 14, y: 70.0, fontSize: 16, align: 'right', weight: 400 },
  { key: 'idCardNumber', x1: 70, x2: 70, y: 73.5, fontSize: 16, align: 'right', weight: 700 },
  { key: 'idIssueDate', x1: 36, x2: 36, y: 73.5, fontSize: 13, align: 'right', weight: 400 },
  { key: 'idIssueAuthority', x1: 15, x2: 15, y: 73.5, fontSize: 16, align: 'right', weight: 400 },
  { key: 'childName', x1: 87, x2: 87, y: 76.6, fontSize: 18, align: 'right', weight: 700 },
];

const PHOTO_BOX = { x1: 10.5, x2: 28.0, y1: 22.2, y2: 38.0 };
const DOCTOR_BOX = { x1: 8, x2: 22, y1: 61.5, y2: 66.0 };
const MUNICIPALITY_BOX = { x1: 5, x2: 25, y1: 83.0, y2: 89.0 };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type FieldKey = keyof FormTextFields;

const as = (v: string | undefined): string => (v && v.trim() ? v : '');

/** يحوّل بيانات الطباعة إلى حقول نص الاستمارة (الاسم واللقب بالفرنسية عند توفّرهما) */
export function buildFormFields(d: PrintData): FormTextFields {
  return {
    regNumber: d.nin ? d.nin.slice(-6) : '',
    pool: as(d.pool),
    firstName: as(d.firstNameLatin) || as(d.name),
    lastName: as(d.lastNameLatin) || as(d.lastName),
    birthDate: as(d.dob),
    address: as(d.address),
    bloodType: as(d.bloodType),
    phoneNumber: as(d.phone),
    whatsapp: as(d.whatsapp),
    doctorName: '',
    guardianName: as(d.guardianName),
    guardianBirthDate: as(d.guardianBirthDate),
    guardianBirthPlace: as(d.guardianBirthPlace),
    idCardNumber: as(d.idCardNumber),
    idIssueDate: as(d.idIssueDate),
    idIssueAuthority: as(d.idIssueAuthority),
    childName: d.category === 'أصاغر' ? `${as(d.firstNameLatin) || as(d.name)} ${as(d.lastNameLatin) || as(d.lastName)}` : '',
  };
}

function drawField(ctx: CanvasRenderingContext2D, text: string, f: FieldBox, W: number, H: number) {
  if (!text) return;
  const fs = f.fontSize ?? Math.round(W * 0.012);
  ctx.save();
  ctx.fillStyle = '#0F2440';
  ctx.font = `${f.weight ?? 700} ${fs}px Tajawal, Arial, sans-serif`;
  ctx.textAlign = f.align ?? 'right';
  ctx.textBaseline = 'middle';
  const x = f.align === 'left' ? (f.x1 / 100) * W : f.align === 'right' ? (f.x2 / 100) * W : ((f.x1 + f.x2) / 200) * W;
  ctx.fillText(text, x, (f.y / 100) * H);
  ctx.restore();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, box: { x1: number; x2: number; y1: number; y2: number }, W: number, H: number) {
  const bx = (box.x1 / 100) * W;
  const bw = ((box.x2 - box.x1) / 100) * W;
  const by = (box.y1 / 100) * H;
  const bh = ((box.y2 - box.y1) / 100) * H;
  const scale = Math.max(bw / img.width, bh / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  const sx = bx + (bw - sw) / 2;
  const sy = by + (bh - sh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.strokeStyle = '#9CA3AF';
  ctx.lineWidth = Math.max(2, W * 0.0015);
  ctx.strokeRect(bx, by, bw, bh);
  if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, sx, sy, sw, sh);
  ctx.restore();
}

/** يولّد Canvas للاستمارة الرسمية مملوءاً آلياً حسب الإحداثيات */
export async function renderFormCanvas(d: PrintData, opts?: { photoUrl?: string; template?: string }): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const tpl = await loadImage(opts?.template ?? templateSrc);
  const W = tpl.naturalWidth;
  const H = tpl.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(tpl, 0, 0, W, H);

  const fields = buildFormFields(d);
  const fieldMap: Record<FieldKey, string> = fields;

  TOP_FIELDS.forEach((f) => drawField(ctx, fieldMap[f.key as FieldKey], f as FieldBox, W, H));
  MEDICAL_FIELDS.forEach((f) => drawField(ctx, fieldMap[f.key as FieldKey], f as FieldBox, W, H));
  GUARDIAN_FIELDS.forEach((f) => drawField(ctx, fieldMap[f.key as FieldKey], f as FieldBox, W, H));

  if (opts?.photoUrl) {
    try {
      const photo = await loadImage(opts.photoUrl);
      drawCoverImage(ctx, photo, PHOTO_BOX, W, H);
    } catch {
      /* تجاهل فشل الصورة */
    }
  }

  return canvas;
}

/** اقتصاص وتصغير تلقائي للصورة الشخصية (إطار عمودي 3:4) */
export async function cropResizePhoto(file: File, maxW = 360, maxH = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const targetRatio = maxW / maxH;
    let sw = img.width;
    let sh = img.height;
    const ratio = sw / sh;
    if (ratio > targetRatio) {
      sw = sh * targetRatio;
    } else {
      sh = sw / targetRatio;
    }
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = maxW;
    canvas.height = maxH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, maxW, maxH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxW, maxH);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** توليد كلمة مرور عشوائية آمنة */
export function randomPassword(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

/** توليد إسم مستخدم من الاسم واللقب (بأحرف لاتينية) */
export function buildUsername(first: string, last: string): string {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const f = norm(first || 'athlete');
  const l = norm(last || '');
  const base = l ? `${f}.${l}` : f;
  return base.slice(0, 24) || 'athlete';
}

/** يولّد Canvas للوجه الثاني للإستمارة: معلومات الحساب (إسم المستخدم، كلمة المرور) الموثّقة */
export async function renderBackCanvas(d: PrintData): Promise<HTMLCanvasElement | null> {
  if (!d.username || !d.password) return null;
  await document.fonts.ready;
  const tpl = await loadImage(templateSrc);
  const W = tpl.naturalWidth;
  const H = tpl.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const fsTitle = Math.max(20, Math.round(W * 0.020));
  const fsSub = Math.max(14, Math.round(W * 0.013));
  const fsRow = Math.max(16, Math.round(W * 0.015));
  const fsMono = Math.max(18, Math.round(W * 0.017));
  const fsSmall = Math.max(12, Math.round(W * 0.011));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F2440';
  ctx.font = `800 ${fsTitle}px Tajawal, Arial, sans-serif`;
  ctx.fillText('نادي الصدارة الرياضي - غرداية', W / 2, H * 0.045);

  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = Math.max(2, W * 0.001);
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.075);
  ctx.lineTo(W * 0.8, H * 0.075);
  ctx.stroke();

  ctx.font = `700 ${fsSub}px Tajawal, Arial, sans-serif`;
  ctx.fillText('الوجه الثاني — معلومات الحساب الرسمي', W / 2, H * 0.105);

  const applicant = [as(d.firstNameLatin) || as(d.name), as(d.lastNameLatin) || as(d.lastName)].filter(Boolean).join(' ');
  if (applicant) {
    ctx.font = `600 ${fsSmall}px Tajawal, Arial, sans-serif`;
    ctx.fillText(`صاحب الطلب: ${applicant}   •   الرمز: ${as(d.nin)}`, W / 2, H * 0.14);
  }

  /* إطار معلومات الحساب في وسط الوجه */
  const bx = W * 0.23;
  const bw = W * 0.54;
  const by = H * 0.2;
  const bh = H * 0.42;
  ctx.fillStyle = '#F4F7FA';
  ctx.strokeStyle = '#0F2440';
  ctx.lineWidth = Math.max(2, W * 0.0012);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#0F2440';
  ctx.font = `800 ${fsSub}px Tajawal, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('بيانات الدخول إلى البوابة (سجّل الدخول بها بعد تفعيل العضوية)', W / 2, by + H * 0.055);

  const drawCred = (label: string, value: string, yFrac: number, mono = true) => {
    ctx.font = `700 ${fsRow}px Tajawal, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F2440';
    ctx.fillText(label, bx + bw * 0.5 - W * 0.02, by + bh * yFrac);
    ctx.textAlign = 'left';
    ctx.font = `${mono ? 700 : 600} ${mono ? fsMono : fsRow}px ${mono ? 'Courier New, monospace' : 'Tajawal, Arial, sans-serif'}`;
    ctx.fillText(value || '—', bx + bw * 0.5 + W * 0.06, by + bh * yFrac);
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.52, by + bh * yFrac + H * 0.016);
    ctx.lineTo(bx + bw * 0.96, by + bh * yFrac + H * 0.016);
    ctx.stroke();
  };

  drawCred('إسم المستخدم :', as(d.username), 0.22);
  drawCred('كلمة المرور :', as(d.password), 0.34);
  drawCred('رقم الوتساب :', as(d.whatsapp) || as(d.phone), 0.46, false);

  ctx.font = `600 ${fsSmall}px Tajawal, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.fillText('احتفظ بهذه المعلومات في مكان آمن — لا تشارك كلمة المرور مع أي طرف.', W / 2, by + bh * 0.68);

  /* المصادقة (موثّقة من طرف صاحب الطلب) */
  ctx.fillStyle = '#0F2440';
  ctx.font = `700 ${fsSub}px Tajawal, Arial, sans-serif`;
  ctx.fillText('إقرار المصادقة', W / 2, H * 0.7);
  ctx.font = `600 ${fsRow}px Tajawal, Arial, sans-serif`;
  ctx.fillText('أقرّ صاحب الطلب بأنه تسلّم معلومات الحساب أعلاه ووافق على اعتمادها للدخول إلى البوابة.', W / 2, H * 0.74);

  ctx.font = `600 ${fsSmall}px Tajawal, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('التوقيع :', W * 0.62, H * 0.84);
  ctx.textAlign = 'left';
  ctx.fillText('التاريخ  :  ' + new Date().toLocaleDateString('fr-DZ'), W * 0.2, H * 0.84);
  ctx.strokeStyle = '#0F2440';
  ctx.lineWidth = Math.max(1.5, W * 0.001);
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.855);
  ctx.lineTo(W * 0.6, H * 0.855);
  ctx.moveTo(W * 0.2, H * 0.865);
  ctx.lineTo(W * 0.35, H * 0.865);
  ctx.stroke();

  return canvas;
}

/** تحميل صورة PNG للاستمارة (الوجهين مدموجين عمودياً) */
export function downloadFormImage(canvases: HTMLCanvasElement[], filename = 'stamara-al-insikhab.png'): void {
  const w = Math.max(...canvases.map((c) => c.width));
  const h = canvases.reduce((s, c) => s + c.height, 0);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  let y = 0;
  canvases.forEach((c) => {
    ctx.drawImage(c, 0, y, c.width, c.height);
    y += c.height;
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

/** توليد وتحميل PDF للاستمارة (الوجه الأول + الوجه الثاني) */
export function downloadFormPdf(canvases: HTMLCanvasElement[], filename = 'stamara-al-insikhab.pdf'): void {
  const c0 = canvases[0];
  const pdf = new jsPDF({
    orientation: c0.width >= c0.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [c0.width, c0.height],
    hotfixes: ['px_scaling'],
    compress: true,
  });
  canvases.forEach((c, i) => {
    if (i > 0) pdf.addPage([c.width, c.height], c.width >= c.height ? 'landscape' : 'portrait');
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, c.width, c.height);
  });
  pdf.save(filename);
}

export interface FeeBreakdown {
  base: number;
  insurance: number;
  transport: number;
  discountPct: number;
  discount: number;
  net: number;
}

/** احتساب تفصيل الحقوق: اشتراك أساسي + تأمين إجباري + نقل مشروط، ثم خصم الاتفاقية والمجموع الصافي */
export function computeFees(d: PrintData): FeeBreakdown {
  const base = (BASE_FEES[d.category as 'أصاغر' | 'أكابر']?.[d.pool ?? ''] as number | undefined) ?? 0;
  const insurance = INSURANCE_FEE;
  const transportFee = d.transport ? TRANSPORT_FEE : 0;
  const discountPct = d.subscriptionType === 'ضمن اتفاقية معتمدة' ? (d.discountPct ?? DEFAULT_DISCOUNT_PCT) : 0;
  const gross = base + insurance + transportFee;
  const discount = Math.round(gross * discountPct * 0.01);
  return { base, insurance, transport: transportFee, discountPct, discount, net: gross - discount };
}

/** تصيير قسيمة وصل حقوق الاشتراك والتأمين على ورقة A4 عمودية (مع رمز QR للمصادقة) */
export async function renderReceiptCanvas(d: PrintData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 794;
  const H = 1123;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const fees = computeFees(d);
  const ink = '#0F2440';
  const gold = '#D4AF37';
  const muted = '#6B7280';
  const pct = (v: number, base = W) => (v / 100) * base;

  const font = (size: number, weight = 700, unit = 1.4) => `${weight} ${Math.round(size * unit)}px Tajawal, Arial, sans-serif`;
  const right = (text: string, xp: number, yp: number, size: number, color = ink, weight = 700, unit = 1.4) => {
    ctx.font = font(size, weight, unit);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pct(xp), pct(yp, H));
  };
  const left = (text: string, xp: number, yp: number, size: number, color = ink, weight = 700, unit = 1.4) => {
    ctx.font = font(size, weight, unit);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pct(xp), pct(yp, H));
  };
  const center = (text: string, xp: number, yp: number, size: number, color = ink, weight = 700, unit = 1.4) => {
    ctx.font = font(size, weight, unit);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pct(xp), pct(yp, H));
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = '#E5E7EB', width = 1.2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pct(x1), pct(y1, H));
    ctx.lineTo(pct(x2), pct(y2, H));
    ctx.stroke();
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  /* رأس القسيمة */
  line(5, 14, 95, 14, gold, 4);
  center('كشكول حقوق الاشتراك والتأمين السنوي', 50, 6.2, 23, ink, 800);
  center('نادي الصدارة - Ghardaïa', 50, 9.2, 12, muted, 600);
  center('رقم الوصل: ' + (d.receiptNumber || '—'), 50, 12.2, 11, ink, 700);
  left('تاريخ الدفع: ' + new Date().toLocaleDateString('fr-DZ'), 6, 12.2, 10, muted, 600);
  left('الساعة: ' + new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' }), 30, 12.2, 10, muted, 600);

  /* بيانات العضو */
  const member: Array<[string, string]> = [
    ['اسم المنخرط', `${d.name} ${d.lastName}`],
    ['التخصص / الرياضة', `${d.sport}${(d.swimStyle ?? []).length ? ' • ' + (d.swimStyle ?? []).join(' / ') : ''}`],
    ['الفئة', d.category || '—'],
    ['نوع الاشتراك', d.subscriptionType || '—'],
    ['بيان الاتفاقية', d.agreementName || '—'],
    ['المنشأة (المسبح)', d.pool || '—'],
    ['رقم الرياضي', d.nin || '—'],
  ];
  let my = 18.5;
  member.forEach(([k, v]) => {
    right(k + ':', 40, my, 11, muted, 600);
    right(v, 94, my, 12, ink, 700);
    my += 3.1;
  });

  /* جدول التفصيل */
  const rows: Array<[string, number]> = [
    ['حقوق الاشتراك الأساسية (' + (d.category || '—') + ')', fees.base],
    ['قسط التأمين السنوي الإجباري', fees.insurance],
    ['خدمة النقل', fees.transport],
  ];
  const tY = 42;
  const top = (v: number) => pct(tY + v, H);

  ctx.fillStyle = '#0B121E';
  ctx.fillRect(0, top(0) - pct(0.8, H), W, pct(1.6, H) + pct(0.8, H));
  center('التفصيل', 6, top(0), 12, '#ffffff', 800);

  let ry = 2.3;
  rows.forEach(([label, amount]) => {
    right(label + ':', 40, top(ry), 11, muted, 600);
    left(fmtDA(amount), 50, top(ry), 12, ink, 700);
    line(6, top(ry + 1.2), 94, top(ry + 1.2));
    ry += 2.3;
  });

  if (fees.discountPct > 0) {
    right('خصم الاتفاقية (' + fees.discountPct + '%) :', 40, top(ry), 11, '#007377', 600);
    left('- ' + fmtDA(fees.discount), 50, top(ry), 12, '#007377', 700);
    line(6, top(ry + 1.2), 94, top(ry + 1.2));
    ry += 2.3;
  }

  ctx.fillStyle = '#0F2440';
  ctx.fillRect(0, top(ry) - pct(1.4, H), W, pct(2.9, H));
  right('المجموع الصافي: ' + fmtDA(fees.net), 88, top(ry), 17, '#ffffff', 800);
  line(4, top(ry + 2.0), 96, top(ry + 2.0), '#D4AF37', 3);

  const payY = tY + ry + 7;
  const payRows: Array<[string, string]> = [
    ['طريقة الدفع', d.paymentMethod || '—'],
    ['أمين المال / الإدارة', 'الاسم: ................................  التوقيع: ....................'],
  ];
  let py = 1.0;
  payRows.forEach(([k, v]) => {
    right(k + ':', 40, top(payY - tY + py), 11, muted, 600);
    right(v, 94, top(payY - tY + py), 11, ink, 700);
    py += 3.2;
  });

  /* توقيع وخاتم أمين المال */
  const sigY = 63;
  line(60, sigY + 12, 94, sigY + 12);
  right('توقيع وخاتم أمين المال', 94, sigY + 14.5, 11, muted, 600);
  line(4, sigY + 12, 40, sigY + 12);
  right('توقيع المنخرط / الولي', 40, sigY + 14.5, 11, muted, 600);

  /* رمز QR للمصادقة */
  const qrText = [
    'SADARA47:RECEIPT',
    'N:' + (d.receiptNumber || ''),
    'MEMBER:' + (d.nin || (d.name + ' ' + d.lastName)),
    'NET:' + fees.net,
    'DATE:' + new Date().toISOString().slice(0, 10),
  ].join('|');
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(qrText, { width: 128, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    qr = null;
  }
  if (qr) {
    const img = new Image();
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.src = qr!;
    });
    const qs = pct(16, H);
    ctx.drawImage(img, pct(72), pct(64, H), qs, qs);
    center('رمز QR للمصادقة', 80, pct(83.5, H), 10, muted, 600);
  }

  line(5, 88, 95, 88, gold, 4);
  center('قسيمة تُرفق ملف المنخرط وتُسلَّم مع الاستمارة', 50, 96.5, 11, muted, 600);
  center('مكتب التحفيظ - نادي الصدارة 2026', 50, 98.5, 10, muted, 600);

  return canvas;
}
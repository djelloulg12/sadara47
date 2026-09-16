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
  kit: number;
  gross: number;
  discountPct: number;
  discount: number;
  net: number;
}

/** احتساب تفصيل الوصل: اشتراك عضوية (نوع مُكوَّن من لوحة المسير) + تأمين + نقل/بدلة عند التفعيل ثم خصم الاتفاقية */
export function computeFees(d: PrintData): FeeBreakdown {
  const base =
    typeof d.subscriptionAmount === 'number' && d.subscriptionAmount > 0
      ? d.subscriptionAmount
      : ((BASE_FEES[d.category as 'أصاغر' | 'أكابر']?.[d.pool ?? ''] as number | undefined) ?? 0);
  const insurance = Number(d.insuranceFee ?? INSURANCE_FEE);
  const transport = d.transport ? Number(d.transportFee ?? TRANSPORT_FEE) : 0;
  const kit = d.kit ? Number(d.kitFee ?? 0) : 0;
  const discountPct = /اتفاقية/.test(d.subscriptionType ?? '') ? (d.discountPct ?? DEFAULT_DISCOUNT_PCT) : 0;
  const gross = base + insurance + transport + kit;
  const discount = Math.round(gross * discountPct * 0.01);
  return { base, insurance, transport, kit, gross, discountPct, discount, net: gross - discount };
}

/** تصيير وصل حقوق الاشتراك والتأمين بتصميم النادي (رقم أخضر مؤطر + بيانات العضو + جدول الرسوم + المجموع الصافي) */
export async function renderReceiptCanvas(d: PrintData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 620;
  const H = 880;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const fees = computeFees(d);

  const navy = '#0f172a';
  const slate = '#334155';
  const muted = '#64748b';
  const border = '#e2e8f0';
  const green = '#16a34a';
  const greenDark = '#15803d';
  const greenBg = '#f0fdf4';
  const boxBg = '#f8fafc';
  const band = '#f1f5f9';

  const font = (size: number, weight = 700) => `${weight} ${size}px Tajawal, Arial, sans-serif`;
  const fmt = (v: number, suffix = true) => `${(v || 0).toLocaleString('fr-DZ')}${suffix ? ' دج' : ''}`;
  const text = (t: string, x: number, y: number, size: number, color = navy, weight = 700, align: CanvasTextAlign = 'right') => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
  };
  const center = (t: string, y: number, size: number, color = navy, weight = 700) => text(t, W / 2, y, size, color, weight, 'center');
  const right = (t: string, x: number, y: number, size: number, color = navy, weight = 700) => text(t, x, y, size, color, weight, 'right');
  const left = (t: string, x: number, y: number, size: number, color = navy, weight = 700) => text(t, x, y, size, color, weight, 'left');
  const cc = (t: string, x: number, y: number, size: number, color = navy, weight = 700) => text(t, x, y, size, color, weight, 'center');
  const dashed = (y: number, color = border) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W - 40, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const rrect = (x: number, y: number, w: number, h: number, r: number, fill?: string, strokeW = 0, strokeColor = border) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (strokeW > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
  };

  /* خلفية الصفحة وبطاقة الوصل */
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, W, H);
  rrect(16, 14, W - 32, H - 28, 18, '#ffffff', 1.5, border);

  /* ترويسة النادي ورقم الوصل المؤطر بالأخضر */
  center('نادي الصدارة الرياضي', 52, 26, navy, 800);
  center('وصل سداد اشتراك / تجديد عضوية', 80, 14, muted, 600);
  dashed(100);
  const badgeText = 'رقم الوصل: ' + (d.receiptNumber || '—');
  ctx.font = font(15, 700);
  const tw = ctx.measureText(badgeText).width;
  const bw = tw + 44;
  const bh = 34;
  const bx = (W - bw) / 2;
  const by = 118;
  rrect(bx, by, bw, bh, 20, greenBg, 2, green);
  text(badgeText, W / 2, by + bh / 2, 15, greenDark, 700, 'center');

  /* بيانات العضو والاشتراك */
  const miY = 168;
  const miL = 40;
  const miR = W - 40;
  const miH = 160;
  rrect(miL - 8, miY, miR - miL + 16, miH, 12, boxBg);
  const row = (label: string, value: string, y: number, x = miR) => {
    right(`${label}:`, x - 190, y, 12.5, muted, 600);
    right(value, x, y, 13, navy, 700);
  };
  row('اسم المنخرط', `${d.name} ${d.lastName}`, miY + 26);
  left('رقم العضوية: ' + (d.membershipNumber || '—'), miL, miY + 26, 13, navy, 700);
  let mv = miY + 26;
  const memberRows: Array<[string, string, 'full' | 'left']> = [
    ['الفرع / النشاط', `${d.sport}${(d.swimStyle ?? []).length ? ' • ' + (d.swimStyle ?? []).join(' / ') : ''} ${d.category ? ' - ' + d.category : ''}`, 'full'],
    ['نوع الاشتراك', `${d.subscriptionType || '—'}${d.agreementName ? ' (' + d.agreementName + ')' : ''}`, 'full'],
  ];
  memberRows.forEach(([label, value]) => {
    mv += 26;
    row(label, value, mv);
  });
  mv += 26;
  row('فترة الاشتراك', d.season || '—', mv);
  left('طريقة الدفع: ' + (d.paymentMethod || '—'), miL, mv, 13, navy, 700);
  mv += 26;
  row('تاريخ التسديد', new Date().toLocaleDateString('fr-DZ'), mv);
  left('الساعة: ' + new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' }), miL, mv, 12.5, muted, 600);

  /* جدول الرسوم والخدمات */
  const thY = miY + miH + 26;
  const tLeft = miL - 8;
  const tRight = miR + 8;
  const tW = tRight - tLeft;
  const colMoney = 56;
  const colPeriod = tLeft + (tW - colMoney) * 0.45;
  const colDesc = tLeft + (tW - colMoney) * 0.18;
  rrect(tLeft, thY, tW, 34, 10, band);
  right('البيان', tRight, thY + 17, 12.5, '#475569', 700);
  cc('المدة', colPeriod + colMoney / 2, thY + 17, 12.5, '#475569', 700);
  left('المبلغ', tLeft + colMoney, thY + 17, 12.5, '#475569', 700);

  const itemRows: Array<[string, string, number, string?]> = [
    [`اشتراك العضوية (${d.subscriptionType || '—'})`, d.subscriptionPeriod || 'موسم', fees.base],
    ['قسط التأمين السنوي الإجباري', 'سنة', fees.insurance],
  ];
  if (fees.transport > 0) itemRows.push(['خدمة النقل', d.subscriptionPeriod || 'موسم', fees.transport]);
  if (fees.kit > 0) itemRows.push(['البدلة الرياضية الرسمية', 'طقم', fees.kit]);
  if (fees.discount > 0) itemRows.push([`خصم الاتفاقية (${fees.discountPct}%)`, '—', -fees.discount, greenDark]);

  let iy = thY + 34 + 15;
  itemRows.forEach(([label, period, amount, color]) => {
    right(label, tRight, iy, 12.5, slate, 700);
    cc(period, colPeriod + colMoney / 2, iy, 12, slate, 600);
    left(fmt(amount), tLeft + colMoney, iy, 12.5, color || navy, 700);
    dashed(iy + 15, '#f1f5f9');
    iy += 30;
  });

  /* المجاميع */
  const totY = iy + 8;
  dashed(totY);
  const totals: Array<[string, string, string?]> = [
    ['المبلغ الإجمالي المستحق', fmt(fees.gross)],
    ['المبلغ المدفوع', fmt(fees.net)],
    ['المبلغ المتبقي', '0.00 دج (خالص)', greenDark],
  ];
  let ty = totY + 18;
  totals.forEach(([label, value, color]) => {
    right(label, tRight, ty, 13, slate, 700);
    left(value, tLeft + colMoney, ty, 13, color || navy, 700);
    ty += 26;
  });

  /* رمز QR للتحقق + تذييل أمانة الصندوق */
  const qrText = [
    'SADARA47:RECEIPT',
    'N:' + (d.receiptNumber || ''),
    'MEMBER:' + (d.nin || (d.name + ' ' + d.lastName)),
    'NET:' + fees.net,
    'DATE:' + new Date().toISOString().slice(0, 10),
  ].join('|');
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(qrText, { width: 96, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    qr = null;
  }
  const footY = H - 150;
  if (qr) {
    const img = new Image();
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.src = qr!;
    });
    const qs = 62;
    ctx.drawImage(img, tLeft + colMoney - 4, footY - 8, qs, qs);
    left('رمز QR للمصادقة', tLeft + colMoney + 64, footY + 23, 10.5, muted, 600);
  }
  dashed(footY - 40, '#e2e8f0');
  center('يرجى الاستظهار بهذا الوصل أو بطاقة الانخراط عند الدخول للتدريبات.', footY + 18, 11.5, muted, 600);
  center('أمانة صندوق النادي — ختم وإمضاء', footY + 44, 13.5, navy, 800);
  center('نادي الصدارة • غرداية • ' + (d.season || 'موسم 2026 / 2027'), H - 26, 10, muted, 600);

  return canvas;
}
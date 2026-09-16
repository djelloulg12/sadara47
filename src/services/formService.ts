import { jsPDF } from 'jspdf';
import templateSrc from '@/assets/form-template.jpg';
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
  doctorName: string;
  guardianName: string;
  guardianBirthDate: string;
  guardianBirthPlace: string;
  idCardNumber: string;
  idIssueDate: string;
  idIssueAuthority: string;
  childName: string;
}

/* أ. بيانات المنخرط الأساسية (الجزء العلوي) — خط 20px */
const TOP_FIELDS: FieldBox[] = [
  { key: 'regNumber', x1: 12, x2: 24, y: 21.5, fontSize: 20, align: 'center', weight: 800 },
  { key: 'pool', x1: 43, x2: 90, y: 21.5, fontSize: 20, weight: 700 },
  { key: 'firstName', x1: 30, x2: 82, y: 25.5, fontSize: 20, weight: 700 },
  { key: 'lastName', x1: 30, x2: 82, y: 29.0, fontSize: 20, weight: 700 },
  { key: 'birthDate', x1: 30, x2: 82, y: 32.5, fontSize: 20, weight: 700 },
  { key: 'address', x1: 30, x2: 82, y: 36.0, fontSize: 20, weight: 700 },
  { key: 'bloodType', x1: 30, x2: 82, y: 39.5, fontSize: 20, weight: 700 },
  { key: 'phoneNumber', x1: 30, x2: 82, y: 43.0, fontSize: 20, weight: 700 },
];

/* ب. الشهادة الطبية (الجزء الأوسط) — خط 20px */
const MEDICAL_FIELDS: FieldBox[] = [{ key: 'doctorName', x1: 30, x2: 71, y: 49.5, fontSize: 20, weight: 700 }];

/* ج. التصريح الأبوي والمصادقة (الجزء السفلي) — خط 16px */
const GUARDIAN_FIELDS: FieldBox[] = [
  { key: 'guardianName', x1: 52, x2: 74, y: 70.0, fontSize: 16, weight: 600 },
  { key: 'guardianBirthDate', x1: 18, x2: 33, y: 70.0, fontSize: 16, weight: 600 },
  { key: 'guardianBirthPlace', x1: 2, x2: 14, y: 70.0, fontSize: 16, weight: 600 },
  { key: 'idCardNumber', x1: 51, x2: 70, y: 73.5, fontSize: 16, weight: 600 },
  { key: 'idIssueDate', x1: 20, x2: 36, y: 73.5, fontSize: 16, weight: 600 },
  { key: 'idIssueAuthority', x1: 2, x2: 15, y: 73.5, fontSize: 16, weight: 600 },
  { key: 'childName', x1: 51, x2: 87, y: 76.5, fontSize: 16, weight: 600 },
];

const PHOTO_BOX = { x1: 10, x2: 28, y1: 22, y2: 38 };
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

/** يحوّل بيانات الطباعة إلى حقول نص الاستمارة */
export function buildFormFields(d: PrintData): FormTextFields {
  return {
    regNumber: d.nin ? d.nin.slice(-6) : '',
    pool: as(d.pool),
    firstName: as(d.name),
    lastName: as(d.lastName),
    birthDate: as(d.dob),
    address: as(d.address),
    bloodType: as(d.bloodType),
    phoneNumber: as(d.phone),
    doctorName: '',
    guardianName: as(d.guardianName),
    guardianBirthDate: as(d.guardianBirthDate),
    guardianBirthPlace: as(d.guardianBirthPlace),
    idCardNumber: as(d.idCardNumber),
    idIssueDate: as(d.idIssueDate),
    idIssueAuthority: as(d.idIssueAuthority),
    childName: d.category === 'أصاغر' ? `${as(d.name)} ${as(d.lastName)}` : '',
  };
}

function drawField(ctx: CanvasRenderingContext2D, text: string, f: FieldBox, W: number, H: number) {
  if (!text) return;
  const fs = f.fontSize ?? Math.round(W * 0.0105);
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.font = `${f.weight ?? 700} ${fs}px Tajawal, Arial, sans-serif`;
  ctx.textAlign = f.align ?? 'center';
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

/** تحميل صورة PNG للاستمارة */
export function downloadFormImage(canvas: HTMLCanvasElement, filename = 'stamara-al-insikhab.png'): void {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

/** توليد وتحميل PDF للاستمارة */
export function downloadFormPdf(canvas: HTMLCanvasElement, filename = 'stamara-al-insikhab.pdf'): void {
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
    hotfixes: ['px_scaling'],
    compress: true,
  });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
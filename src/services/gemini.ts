import { GoogleGenAI } from '@google/genai';
import { Athlete, Sport, UserRole } from '../types';

const API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (typeof process !== 'undefined' && (process as any).env?.GEMINI_API_KEY) ||
  '';

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const model = 'gemini-2.5-flash';

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generate = async (prompt: string): Promise<string | null> => {
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text?.trim();
    return text || null;
  } catch (error) {
    console.error('AI generation error:', error);
    return null;
  }
};

/* ----------------------- Offline fallbacks ----------------------- */

const BIOS: Record<Sport, Array<(n: string) => string>> = {
  [Sport.SWIMMING]: [
    (name) =>
      `${name} سبّاح متعطّش للتطوّر، يقتات على الانضباط داخل المسبح وخارجه. بجذع قوي وسباحة سلسة، يحوّل كل تمرين إلى خطوة نحو رقم شخصي جديد.`,
  ],
  [Sport.CROSS_COUNTRY]: [
    (name) =>
      `${name} عدّاء يتميّز بالصبر والثبات، يواجه التعب بخطوات مدروسة وقلب كبير. في التضاريس الصعبة والأجواء الحارة، يثبت أن العزيمة تُصنع في التدريب لا في المنافسة.`,
  ],
  [Sport.SPRINTING]: [
    (name) =>
      `${name} عدّاء سريع يملك انفجاراً مميزاً وانطلاقاً حاداً، يعمل كل يوم على تردد الخطوات وقوة الاندفاع. إصراره على التفاصيل الصغيرة هو ما يصنع الفارق على خط النهاية.`,
  ],
};

const TIPS: Record<Sport, string[]> = {
  [Sport.SWIMMING]: [
    'ركّز على تقنية الزفير تحت الماء؛ اقضِ 70% من وقتك في التدريبات التقنية قبل زيادة الشدّة.',
    'قسّم تمرينك إلى: إحماء طويل، مسافة أساسية بوتيرة ثابتة، ثم 6×50م بسرعة مع راحة 30 ثانية.',
    'حافظ على استرخاء الكتفين وارتفاع المرفق في كل ضربة؛ سباحة سلسة أسرع من سباحة قوية ومتعبّة.',
    'درّب الانطلاقة والوصول في كل حصة حتى لو 10 دقائق فقط؛ الزمن الضائع في اللمسة يقرر الفارق.',
    'لا تهمل تمارين الجفاف: عضلات الجذع والأكتاف هي مفتاح سرعتك داخل الماء.',
  ],
  [Sport.CROSS_COUNTRY]: [
    'درّب على أرض متنوعة: تسلقات قصيرة، ثم جري مستوٍ، ثم هبوط — يحسّن التوازن والقوة.',
    'ابدأ كل حصة بجريٍ خفيف 10 دقائق ثم تمارين إطالة ديناميكية قبل الشدّة.',
    'اعمل على استهلاك الأكسجين بجري 3×1000م بسرعة ثابتة تفصلها 3 دقائق هدوء.',
    'اجعل يوم راحة نشطاً: مشي سريع أو سباحة خفيفة لتسريع التعافي.',
    'راقب وتيرتك: ابدأ الحصة أبطأ مما تشعر به، لتنتهي أسرع مما تتوقع.',
  ],
  [Sport.SPRINTING]: [
    'السرعة مبنية على التقنية: درّب الذراعين والوضعية قبل إضافة المزيد من المقاومة.',
    'أدِّ 8×30م انطلاقاً من وضعيات مختلفة مع راحة كاملة، وركّز على الخطوات الثلاث الأولى.',
    'لا تهمل القوة: تمارين القرفصاء والوثب تساعد في القوة الانفجارية للانطلاقة.',
    'خفّف من حجم التدريب قبل المسابقة، فالجودة تنتصر على الكمية في الأنشطة قصيرة المدى.',
    'الاستشفاء بين التكرارات ليس راحة، بل جزء أساسي من التدريب على السرعة القصوى.',
  ],
};

const DIET: Record<Sport, string> = {
  [Sport.SWIMMING]:
    '<ul><li><b>الفطور:</b> شوفان بالحليب + موز + عسل</li><li><b>الغداء:</b> دجاج مشوي + أرز + خضار مطهية</li><li><b>الوجبة الخفيفة قبل التدريب:</b> تمر ومكسرات + زبادي</li><li><b>العشاء:</b> سمك أو بيض + سلطة + خبز أسمر</li><li><b>شرب:</b> 2-3 لتر ماء يومياً</li></ul>',
  [Sport.CROSS_COUNTRY]:
    '<ul><li><b>الفطور:</b> خبز كامل بزيت الزيتون + عسل + حليب</li><li><b>الغداء:</b> كسكس بالخضار والدجاج</li><li><b>الوجبة الخفيفة:</b> فواكه مجففة ومكسرات</li><li><b>العشاء:</b> طاجين بالسمك + خبز أسمر</li><li><b>شرب:</b> ترطيب مستمر قبل وأثناء الجري</li></ul>',
  [Sport.SPRINTING]:
    '<ul><li><b>الفطور:</b> بيض + خبز + عصير طبيعي</li><li><b>الغداء:</b> لحم قليل الدسم + بطاطا + خضار</li><li><b>الوجبة الخفيفة:</b> مشروب البروتين أو اللبن</li><li><b>العشاء:</b> دجاج + أرز + سلطة</li><li><b>شرب:</b> الماء ومشروبات الأملاح بعد التدريب</li></ul>',
};

export const generateAthleteBio = async (
  firstName: string,
  lastName: string,
  age: number,
  sport: Sport,
): Promise<string> => {
  const name = `${firstName} ${lastName}`;
  const prompt = `اكتب سيرة ذاتية قصيرة وملهمة من 3 جمل لرياضي اسمه ${name}, عمره ${age} عاماً, ويتنافس في رياضة ${sport}. اجعلها احترافية ومحفزة بدون تذييل.`;
  const result = await generate(prompt);
  return result || pick(BIOS[sport])(name);
};

export const generateTrainingTip = async (sport: Sport): Promise<string> => {
  const prompt = `قدم نصيحة تدريبية متقدمة ومفيدة لرياضيين في رياضة ${sport} في جملتين بدون تذييل.`;
  const result = await generate(prompt);
  return result || pick(TIPS[sport]);
};

export const generateDietPlan = async (sport: Sport): Promise<string> => {
  const prompt = `اقترح خطة نظام غذائي ليوم واحد لرياضي في رياضة ${sport}. يجب أن تشمل وجبات الإفطار والغداء والعشاء ووجبات خفيفة تناسب المطبخ الجزائري. استخدم HTML بسيط (ul و li و b) بدون أي تذييل.`;
  const result = await generate(prompt);
  return result || DIET[sport];
};

/* ------------------- Performance analysis (Sadara AI) ------------------- */

const ANALYSIS_FALLBACKS = [
  'يتضح من المنحنى الزمني تحسّن تدريجي ومطرد. ننصح بالتركيز على تقنيات الانطلاقة والوصول خلال الحصص القادمة، مع الحفاظ على استقرار الوتيرة في منتصف المسافة. راقب الاستشفاء الليلي لدعم التكيف العضلي.',
  'أداء مستقر مع هامش تطوّر واضح. اعمل خلال أسبوعين على تكرارات قصيرة عالية الشدة مع راحة كاملة لرفع السرعة القصوى، ثم أعد القياس لتقييم الفارق.',
  'النتائج تشير إلى إمكانية وطنية واعدة. ركّز على تثبيت الثبات النفسي في المنافسات، وأضف حصة واحدة أسبوعياً لتدريب القدرة الهوائية خارج المسبح.',
];

export const analyzePerformance = async (athlete: Athlete): Promise<string> => {
  const prompt = `قم بتحليل بيانات أداء السباح التالية وقدم نصائح تدريبية احترافية باللغة العربية.
الأداء: ${JSON.stringify({
    name: `${athlete.name} ${athlete.lastName}`,
    sport: athlete.sport,
    level: athlete.level,
    progress: athlete.progress,
    category: athlete.category,
    coach: athlete.assignedCoach,
  })}
ركّز على: تطور الأرقام، إمكانية المنافسات الوطنية، ونصائح تقنية. أجب بثلاث جمل بدون تذييل.`;
  const result = await generate(prompt);
  return result || pick(ANALYSIS_FALLBACKS);
};

export interface SmartAlert {
  type: 'PERFORMANCE' | 'ABSENCE' | 'COMPETITION';
  title: string;
  detail: string;
  athlete?: string;
}

export const getSmartAlerts = async (athletesData: Athlete[]): Promise<SmartAlert[]> => {
  const prompt = `بناءً على بيانات الرياضيين التالية، حدد 3 تنبيهات "ذكية" مهمة للمدرب.
البيانات: ${JSON.stringify(
    athletesData.map((a) => ({ name: `${a.name} ${a.lastName}`, sport: a.sport, progress: a.progress, level: a.level })),
  )}
أجب فقط بمصفوفة JSON:
[{"type":"PERFORMANCE"|"ABSENCE"|"COMPETITION","title":"عنوان قصير","detail":"وصف بالعربية","athlete":"اسم الرياضي"}]`;

  try {
    if (!ai) return [];
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse((response.text as string) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('AI Alert Generation failed', e);
    return [];
  }
};

export const editAthletePhoto = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
          { text: `Please edit this athlete's profile picture: ${prompt}. Make it look professional for a swimming club member ID.` },
        ],
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error('Photo edit failed', error);
    return null;
  }
};
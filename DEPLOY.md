# النشر — Sadara Platform

## أول مرة فقط (يومان)

```powershell
# 1) حساب Google (يفتح المتصفح)
npm run login

# 2) أسرار النشر في GitHub — انسخ JSON الخاص بخدمة Firebase كما هو
& "C:\Program Files\GitHub CLI\gh.exe" auth login
& "C:\Program Files\GitHub CLI\gh.exe" secret set FIREBASE_SERVICE_ACCOUNT --repo djelloulg12/sadara47

# 3) ادفع، والمهملة تتكفّل بالباقي
git push origin main
```

`FIREBASE_SERVICE_ACCOUNT` هو **JSON خام** وليس base64.
تأخذه من: Firebase Console ← Project Settings ← Service accounts ← Generate new
private key ← ثم انسخ **محتوى الملف** كاملاً.

## بعدها، النشر”按钮 واحد

```powershell
npm run deploy        # فحص + نشر الموقع + نشر قواعد الأمان
npm run preview       # معاينة برابط مؤقت قبل النشر الحقيقي
```

## ما الذي يفعله الـ CI تلقائياً

| المهمة | الوظيفة |
|---|---|
| `verify` | يفحص تطابق `firebase-public` مع المصدر · كل أصل مطلوب موجود · لا ملف خاص في git · الـ workflow نفسه صارم |
| `deploy` | ينشر الموقع + قواعد Firestore + قواعد Storage |

مهمة `deploy` **تُتخطّى** حتى تضع السر، فالمستودع يبقى أخضر قبل ذلك.

## الأوامر اليومية

| الأمر | الغرض |
|---|---|
| `npm run serve` | تشغيل الخادم المحلي على المنفذ 4173 |
| `npm run build` | إعادة بناء `app.js` من الأساس المُختبَر + الطبقات |
| `npm run check` | تشغيل مجموعات الاختبار التسع |
| `npm run user -- --help` | إنشاء حساب staff في قاعدة البيانات المحلية |
| `npm run preview:form` | توليد نموذج الحزمة للطباعة ومعاينته |

## البنية

```
app.js                 يُبنى من tools/build (لا تُعدّله يدويًا)
firebase-public/       النسخة القابلة للنشر، مطابقة للمصدر
tools/build/           الأساس المُختبَر + الطبقات + سكربت التجميع
tools/tests/           مجموعات الاختبار التسع
server.py              واجهة برمجية محلية (SQLite) — نفس الـ 15 نقطة نهاية
firebase-adapter.js    يحوّل fetch إلى Firestore
firestore.rules        صلاحيات قاعدة البيانات
storage.rules          صلاحيات الملفات
schema.sql             مخطط قاعدة البيانات
```

## تنبيهات

- **لا تعدّل `app.js` مباشرة.** عدّل `tools/build/part-*.js` ثم `npm run build`.
- `uploads/scans/` يحتوي وثائق موقّعة شخصية — مستثنى من git تلقائيًا.
- `Card Number.docx` و `*.db` و `*.txt` مستثنية. لا ترفعها.
- للنشر على النطاق: Firebase Console ← Hosting ← Add custom domain.

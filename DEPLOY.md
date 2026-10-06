# النشر — Sadara Platform

> **المشروع:** `sadara-platform-774c8`
> **الرابط الحيّ:** https://sadara-platform-774c8.web.app
> **لوحة التحكّم:** https://console.firebase.google.com/project/sadara-platform-774c8/overview

## ما هو جاهز

| | |
|---|---|
| الموقع منشور | ✅ `sadara-platform-774c8.web.app` |
| Firebase Hosting | ✅ ١٥ ملفاً |
| Cloud Firestore | ✅ قاعدة `(default)` في `europe-west1` |
| قواعد الأمان | ✅ `firestore.rules` مُرفع ومُصرَّح |
| البيانات العامة | ✅ ٣ اشتراكات · ٦ حصص · ٣ إعلانات · ٥ وثائق مدرب |
| PWA | ✅ manifest + ٣ أيقونات + عامل خدمة |
| ٩ مجموعات اختبار | ✅ `npm run check` |

## نقطتان تحتاجان نقرة واحدة منك في المتصفح

### ١. تفعيل تسجيل الدخول — Authentication

Firebase Authentication غير مُهيّأ، ولا توجد طريقة برمجية لإنشائه (الـ API يرجّع `CONFIGURATION_NOT_FOUND`).

1. افتح <https://console.firebase.google.com/project/sadara-platform-774c8/authentication/providers>
2. اضغط **Get started**
3. فعّل **Email/Password**

بعدها استعمل السكربت الجاهز لإنشاء حسابات الطاقم:

```powershell
python tools/seed-accounts.py
```

> ⚠️ **غيّر كلمة المرور فوراً.** الحسابات تُنشأ بكلمة `Sadara@2026` المستعملة محلياً. هي كلمة معروفة — لا تُبقِها على موقع عام.

### ٢. رفع الملفات — Storage (اختياري)

Cloud Storage يحتاج **حساب فوترة**. بدونه تعمل المنصة كاملة عدا:
- صورة المنخرط في بطاقته
- رفع الاستمارة الموقّعة كملف

ما عدا ذلك، تُحفظ الصورة في متصفح العضو (IndexedDB) والنسخة الموقّعة تمرّ عبر نفس الطلب.Activate Storage من:
<https://console.firebase.google.com/project/sadara-platform-774c8/storage>

> تفعيل الفوترة قرار مالي يخصّك — لم أفعله نيابةً عنك.

## الأوامر اليومية

| الأمر | الغرض |
|---|---|
| `npm run serve` | الخادم المحلي على المنفذ 4173 |
| `npm run build` | إعادة بناء `app.js` من الأساس + الطبقات |
| `npm run check` | مجموعات الاختبار التسع |
| `npm run doctor` | فحص الشبكة وشهادات TLS |
| `npm run projects` | مشاريع Firebase المتاحة |
| `npm run deploy` | فحص + نشر الموقع |
| `npm run preview` | معاينة برابط مؤقت |

## كيف نجح النشر على هذا الجهاز

`Kaspersky` يعترض HTTPS ويقدّم شهادته، وNode لا يقرأ متجر Windows. عالجه `tools/firebase.ps1`:

1. يستنتج جذر الاعتراض **بسلوك الشبكة** (يسأل الخادم عن سلسلة الشهادات)
2. يصدّره إلى `tools/intercept-roots.pem`
3. يضبط `NODE_EXTRA_CA_CERTS` ثم يشغّل الـ CLI
4. يمرّر `--interactive` عند `login` وإلا رفض العمل
5. يتحقق أن المشروع في `.firebaserc` موجود قبل النشر

## النشر التلقائي عبر GitHub

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
& "C:\Program Files\GitHub CLI\gh.exe" secret set FIREBASE_SERVICE_ACCOUNT --repo djelloulg12/sadara47
git push origin main
```

`FIREBASE_SERVICE_ACCOUNT` هو **JSON خام** من:
Firebase Console ← Project Settings ← Service Accounts ← Generate new private key.
انسخ **محتوى الملف** كاملاً (ليس base64).

مهمة `verify` تعمل عند كل دفع، و`deploy` تُتخطّى حتى تضع السر.

## البنية

```
app.js                 يُبنى من tools/build — لا تُعدّله يدويًا
firebase-public/       النسخة القابلة للنشر، مطابقة للمصدر
tools/build/           الأساس المُختبَر + ١٦ طبقة + سكربت التجميع
tools/tests/           مجموعات الاختبار التسع
tools/firebase.ps1     غلاف الـ CLI مع 处理 TLS
tools/check-network.js npm run doctor
tools/seed-accounts.py إنشاء حسابات الطاقم + أدوارها
server.py              واجهة محلية (SQLite) — نفس الـ ١٥ نقطة
firebase-adapter.js    يحوّل fetch إلى Firestore
firestore.rules        صلاحيات البيانات
storage.rules          صلاحيات الملفات
schema.sql             مخطط قاعدة البيانات
```

## تنبيهات

- **لا تعدّل `app.js` مباشرة.** عدّل `tools/build/part-*.js` ثم `npm run build`.
- `uploads/scans/` وثائق شخصية — مستثناة من git.
- `Card Number.docx` و `*.db` و `*.txt` مستثنية. لا ترفعها.
- النطاق المخصص: Hosting ← Add custom domain.
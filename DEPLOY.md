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

Firebase Authentication غير مُهيّأ، ولا توجد طريقة برمجية لإنشائه: كل مسارات الـ API
ترجّع `CONFIGURATION_NOT_FOUND` لأن إعداد الهوية نفسه غير موجود.

1. افتح <https://console.firebase.google.com/project/sadara-platform-774c8/authentication/providers>
2. اضغط **Get started**
3. فعّل **Email/Password**

### ٢. مالك النادي — كل الصلاحيات

هذا مطبَّق **الآن** ولا ينتظر التفعيل أعلاه:

```powershell
python tools\set-owner.py                                  # عرض المالك الحالي
python tools\set-owner.py add kabrag12@gmail.com           # إضافة
python tools\set-owner.py remove kabrag12@gmail.com        # إزالة
```

المالك يُسجَّل **ببريده** في `config/owners`، لا بمستند `users/{uid}`، لسببين:

- مستند `users` يحتاج `uid`، و`uid` لا يوجد قبل إنشاء الحساب — فالمالك كان
  سينتظر حساباً كي يستطيع إنشاء حساب
- الحق يتبع الشخص، فلا يحتاج جهازاً جديداً ولا قاعدة مبنيّة من جديد

`firestore.rules` تمنح صاحب هذا البريد **كل** الصلاحيات — بما فيه قراءة وكتابة
`users`، والحذف، والمال، وسجل التدقيق — ولا يحتاج أي مستند دور. العنوان يجب أن
يكون **مُتحقَّقاً منه** (`emailVerified`)، والسكربت يرفض إزالة آخر مالك.

### ٣. حسابات الطاقم

بعد تفعيل Authentication مباشرة، أنشئ حسابات المدير والرئيس والمدرب:

```powershell
python tools\seed-accounts.py
```

يسألك عن كلمة مرورك **دون أن يطبعها أو يخزّنها**. لا توجد كلمة افتراضية في
السكربت، ويرفض أي كلمة أقصر من ١٠ محارف.

لإنشاء حسابات بعنوان بريد حقيقي من النادي:

```powershell
$env:SADARA_SEED_ACCOUNTS = "Head@club.example,president;Coach@club.example,coach"
python tools\seed-accounts.py
```

الأدوار التي تعرفها المنصة، في `firestore.rules` وفي الصفحة معاً:

| الدور | ما يستطيعه |
|---|---|
| `admin` | كل شيء، بما فيه الإعدادات |
| `president` | القبول والرفض، الاشتراكات، البطاقات، التحصيل |
| `coach` | الحضور والمواعيد فقط |
| `member` · `parent` | ملف العضو، البطاقة، الجدول، الإعلانات |
| `swimmer_adult` · `swimmer_minor` | فضاء السباح: بطاقته وحضوره |

> التحصيل ورفع النسخة الموقّعة من صلاحية **المسيّر = `admin` أو `president`**.
> دور `manager` غير موجود في المنصة، وإن أُنشئ حساب به فلن يجد أي صلاحية.
> السكربت يرفض أي دور خارج هذه القائمة.

## الدخول على الخادم المحلي

`npm run serve` محلياً يستعمل قاعدة `sadara-local.db`، والحسابات لا تُنشأ فيها
تلقائياً — بيانات الدخول تأتي من متغيّرات البيئة حصراً. لذلك يطبع الخادم عند
الإقلاع من يستطيع الدخول:

```
Sadara platform listening on port 4173
  قاعدة البيانات: ...\sadara-local.db
  الحسابات التي يمكنها الدخول (3):
    admin@sadara.local         admin
    president@sadara.local     president
    coach@sadara.local         coach
  كلمة المرور: ما اخترته أنت عند إنشاء الحساب.
  لإنشاء حساب أو تغيير كلمة مرور:  npm run user
```

ولإنشاء حساب أو تغيير كلمة مرور:

```powershell
npm run user
```

يسألك عن البريد والدور وكلمة المرور، **وكلمة المرور دون أن تظهر ولا تُكتب في
سجلّ الأوامر**.

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
| `npm run build` | إعادة بناء `app.js` من الأساس + الطبقات + نسخه إلى `firebase-public` |
| `npm run check` | مجموعات الاختبار التسع |
| `npm run check:print` | قياس مواضع الطباعة على صورة الاستمارة نفسها |
| `npm run check:all` | الاختبارات + قياس المواضع (قبل كل نشر) |
| `npm run doctor` | فحص الشبكة وشهادات TLS |
| `npm run projects` | مشاريع Firebase المتاحة |
| `npm run deploy` | فحص + نشر الموقع |
| `npm run preview` | معاينة برابط مؤقت |
| `npm run preview:form` | معاينة الحزمة في `tools/tests/out/packet-preview.html` |
| `npm run preview:placement` | معاينة الاستمارة بالإطارات الحمراء في `tools/tests/out/form-placement.html` |
| `npm run preview:print` | يكتب صفحتَي الطباعة في `tools/tests/out/istimara-print-*.html` |

## استمارة التسجيل العامة — `/istimara/`

صفحة مستقلة في مجلدها على المنصة المنشورة:

```
https://sadara-platform-774c8.web.app/istimara/
```

**بلا حساب وبلا تسجيل دخول.** ترسل إلى `POST /api/applications` نفسه الذي
تستخدمه استمارة المنصة، فتصل بحالة `pending` وتظهر في شاشة الطلبات التي يراها
رئيس النادي، بلا تعديل على لوحة الإدارة ولا على `firestore.rules`.

| | |
|---|---|
| الملفات | `istimara/` ← تُنسخ إلى `firebase-public/istimara/` عند `npm run build` |
| تُنشر مع | `firebase.json` — لا حاجة إلى قاعدة Hosting جديدة |
| تعمل بلا إنترنت | `sw.js` يخزّن صدفة الاستمارة؛ الإرسال يذهب للشبكة دائماً |
| المسودة | `localStorage` على جهاز الزائر، تُمسح بعد الإرسال |

### ما يُطبع

صفحتان في نداء واحد: **استمارة النادي الرسمية** على الصورة الأصلية، ثم **ملخّص
A4** للطبيب والاشتراك والدفع والتوقيع. تُطبعان بمقاس A4 كامل بهوامش «بدون»،
لأن مواضع الاستمارة مقيسة بالمليمتر.

### إحداثيات واحدة لا نسختان

`FORM_SPOTS` في `istimara/print.js` هي نفسها في `app.js`. مجموعة `istimara` في
`npm run check` تقارن المواضع وصندوق الصورة وثوابت `SPOT_GAP` و`SPOT_CLEAR`
بين النسختين وتقبل فرقًا أقل من 0.001 مم، فتكتب استمارة المنصة واستمارة الصفحة
العامة بنفس القاعدة التي يقرأ بها النادي الاستمارة.

> إن غيّرت إحداثيًا في `app.js`، انسخه إلى `istimara/print.js` (أو العكس)،
> وإلا فشلت `npm run check` قبل النشر.

## طباعة الاستمارة الرسمية

الحقول موضوعة **على صورة الاستمارة الأصلية للنادي**، لا على تخطيط من صنعنا. كل حقل
يقع بين السطر المطبوع على يساره والنقطتين الرأسيتين على يمينه، فتظهر البيانات
دائماً **بعد النقطتين** ولا تغطي كلام النادي.

`tools/check-form-placement.py` يقرأ `FORM_SPOTS` من `app.js` ثم **يقيس الصورة
نفسها** ويتأكد من ثلاثة أشياء لكل حقل:

1. الصندوق يبدأ ملاصقاً للنقطتين (1.6 مم)
2. يبقى داخل سطره ولا يخرج عن الصفحة
3. يقع على ورق فارغ — إن وُجد حبر مطبوع مكانه فالطباعة تُفسد كلام النادي

```powershell
python tools\check-form-placement.py
```

إن أضفت حقلاً أو غيّرت الإحداثيات، شغّل هذا الأمر قبل `npm run check`.

### ما لا يُطبع على الاستمارة

النموذج المطبوع لا يتّسع لاسم **الطبيب** ولا لـ**التوقيع** ولا لـ**مكان إصدار
البطاقة**، فلا تكتب المنصة شيئاً فوق كلام النادي في هذه المواضع. البيانات تبقى
في المنصة، ويظهر اسم الطبيب في وصل الاستلام الذي يوقّعه المحاسب أو المسيّر.

وكذلك يبقى قسم **تصريح ولي الأمر** على استمارة الأصاغر فقط: فئة «الأكابر» تسجّل
نفسها فلا يطبع النموذج أي اسم ولي ولا رقم تعريفه.


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
app.js                   يُبنى من tools/build — لا تُعدّله يدويًا
istimara/                استمارة التسجيل العامة (مجلد مستقل يُنشر في /istimara/)
firebase-public/         النسخة القابلة للنشر، مطابقة للمصدر
tools/build/             الأساس المُختبَر + ١٦ طبقة + سكربت التجميع
tools/tests/             مجموعات الاختبار + أدوات المعاينة
tools/tests/form-print-preview.js  يكتب صفحتَي الطباعة للمعاينة
tools/firebase.ps1       غلاف الـ CLI مع معالجة اعتراض TLS
tools/check-network.js   npm run doctor
tools/check-form-placement.py  قياس مواضع الطباعة على صورة الاستمارة
tools/seed-accounts.py   إنشاء حسابات الطاقم + أدوارها
server.py                واجهة محلية (SQLite) — نفس الـ ١٥ نقطة
firebase-adapter.js      يحوّل fetch إلى Firestore
firestore.rules          صلاحيات البيانات
storage.rules            صلاحيات الملفات
sw.js                    عامل الخدمة: الشبكة أولاً للكود، والنسخ المخزَّنة للصور
schema.sql               مخطط قاعدة البيانات
```

## تنبيهات

- **لا تعدّل `app.js` مباشرة.** عدّل `tools/build/part-*.js` ثم `npm run build`.
- **لا تكرّر نفس `function` في طبقتين.** آخر نسخة هي التي تعمل، والأولى تصبح
  كوداً ميتاً دون إنذار. سكربت البناء يرفض التكرار الآن.
- **`hidden` وحده لا يكفي لإخفاء عنصر** إذا كانت لصنفه قاعدة `display`. لذلك
  `styles.css` فيه `[hidden]{display:none!important}`.
- **`sw.js` يجلب الكود من الشبكة أولاً.** طباعة الاستمارة معتمدة على مواضع
  مقيسة، ولنسخة مخزَّنة منها تُملأ استمارة على ورق غير مطابق.
- `uploads/scans/` وثائق شخصية — مستثناة من git.
- `Card Number.docx` و `*.db` و `*.txt` مستثنية. لا ترفعها.
- النطاق المخصص: Hosting ← Add custom domain.
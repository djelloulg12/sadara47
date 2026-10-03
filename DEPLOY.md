# النشر

المنصة تُنشر على **Firebase Hosting** مع Firebase Auth وFirestore وStorage. ملفات `server.py` و`schema.sql` هي نسخة مكافئة للتشغيل المحلي والاختبار فقط، وليست جزءًا من النشر السحابي.

## 1. النشر التلقائي عبر GitHub

1. اربط المستودع بمشروع Firebase `sadara-platform` (موجود في `.firebaserc`).
2. أضف السر `FIREBASE_SERVICE_ACCOUNT` في **Settings → Secrets and المتغيرات → Actions**.
3. ادفع إلى `main` أو `master`، أو شغّل_workflow يدويًا من تبويب Actions.

الـ workflow يقوم بثلاث خطوات:

1. يتحقق أن `firebase-public/` مطابقة لمجلد المصدر (وإلا يفشل النشر).
2. ينشر `firebase-public/` على Hosting حسب `firebase.json`.
3. ينشر `firestore.rules` و`storage.rules`.

## 2. النشر اليدوي

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore:rules,storage --project sadara-platform
```

## المتغيرات السرية

### للنشر على Render / Docker

- `SADARA_ADMIN_EMAIL` و`SADARA_ADMIN_PASSWORD`
- `SADARA_PRESIDENT_EMAIL` و`SADARA_PRESIDENT_PASSWORD`
- `SADARA_COACH_EMAIL` و`SADARA_COACH_PASSWORD`
- `PORT` (اختياري، الافتراضي 4173)
- `SADARA_DB_PATH` (اختياري، مسار قاعدة SQLite)

لا تضع كلمات المرور داخل GitHub أو داخل ملفات المشروع. الخادم ينشئ حسابات الإدارة من هذه المتariables عند أول تشغيل فقط (INSERT OR IGNORE).

### في Firebase

بيانات `firebase-config.js` عامة بطبيعتها (قيود أمانها في `firestore.rules`)، لكن **يجب** ضبط:

- Authentication → Sign-in method: Email/Password (مفعّل) وPhone إن أردت الدخول عبر SMS.
- Authorized domains: أضف نطاق الاستضافة custom domain.
- Cloud Firestore: أنشئ قاعدة البيانات في نفس المشروع.

## خطوة إلزامية: أدوار الحسابات

قواعد Firestore تقرأ الدور من مستند `users/{uid}`. أنشئ هذه المستندات من Firestore Console، مثلًا:

| الحقل | مثال |
| --- | --- |
| `name` | `رئيس النادي` |
| `role` | `president` أو `admin` أو `coach` أو `swimmer_adult` أو `parent` |
| `member_no` | رقم الانخراط (اختياري — يربط الحساب ببطاقة السباح) |
| `phone` | رقم الهاتف (اختياري — بديل للربط) |

حساب يفتقد هذا المستند يُعامل كـ `member` فقط.

## ملاحظات إنتاجية

- حدّد النطاق المخصص وفعّل HTTPS.
- فعّل Firebase App Check إن أردت حماية إضافية.
- راجع `firestore.rules`: طلبات التسجيل العامة تُحفظ دائمًا بحالة `pending`، وطلبات المدربين مرتبطة بحساب صاحب الطلب، وملفات PDF للمدربين يقرأها رؤساء النادي أو صاحب الطلب.
- لا تنشر `sadara.db` ولا `.env`.
- احتفظ بنسخة احتياطية دورية لـ Firestore (الاشتراك المدفوع أو التصدير اليدوي).
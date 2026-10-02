# النشر

المنصة الكاملة تحتوي على Python API وقاعدة SQLite، لذلك لا يكفي نشر ملفات HTML على GitHub Pages.

## Render

1. اربط مستودع GitHub بخدمة الاستضافة.
2. في Render اختر **New Web Service** ثم المستودع.
3. سيكتشف Render ملف `render.yaml` و`Dockerfile` تلقائيًا.
4. بعد النشر افتح الرابط الذي يمنحه Render.

## المتغيرات السرية المطلوبة

أضف متغيرات البيئة في لوحة الاستضافة قبل التشغيل:

- `SADARA_ADMIN_EMAIL` و`SADARA_ADMIN_PASSWORD`
- `SADARA_PRESIDENT_EMAIL` و`SADARA_PRESIDENT_PASSWORD`
- `SADARA_COACH_EMAIL` و`SADARA_COACH_PASSWORD`

لا تضع كلمات المرور داخل GitHub أو داخل ملفات المشروع.

للنشر الإنتاجي الحقيقي استخدم PostgreSQL بدل SQLite، وحدد كلمة مرور إدارة جديدة ومتغيرات سرية.


# النشر

المنصة الكاملة تحتوي على Python API وقاعدة SQLite، لذلك لا يكفي نشر ملفات HTML على GitHub Pages.

## Render

1. ارفع المشروع إلى مستودع GitHub خاص أو عام.
2. في Render اختر **New Web Service** ثم المستودع.
3. سيكتشف Render ملف `render.yaml` و`Dockerfile` تلقائيًا.
4. بعد النشر افتح الرابط الذي يمنحه Render.

للنشر الإنتاجي الحقيقي استخدم PostgreSQL بدل SQLite، وحدد كلمة مرور إدارة جديدة ومتغيرات سرية.


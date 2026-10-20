# Sadara Platform — صورة واحدة تخدم الموقع والـ API معًا.
# ----------------------------------------------------------------------------
# عملية Node واحدة (tools/neon/server/server.js) تقدّم ملفات الواجهة من
# firebase-public/ وتردّ على /api/* من قاعدة Neon. لا فصل بين واجهة وخلفية:
# الجلسة كوكي على نفس الأصل (same-origin)، والفصل يكسرها.
#
# pg وحده هو التبعية وقت التشغيل، وهو JavaScript خالص — لا تجميع أصلي.
FROM node:22-slim

WORKDIR /app

# التبعيات أولًا: طبقة تُخزَّن ولا يُعاد بناؤها عند تغيّر الملفات فقط.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# بقية المشروع (منها firebase-public/ و tools/neon/server/).
COPY . .

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
EXPOSE 4180

# PORT يضبطه المضيف (Render)، والافتراضي 4180 محليًا.
CMD ["node", "tools/neon/server/server.js"]

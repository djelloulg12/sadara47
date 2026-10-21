/* ============================================================================
   رقم الانخراط الموحّد — part-membership.js

   الصيغة عشرة خانات: [S|C|R][سنة الموسم][1|2|0][تسلسل من أربع خانات]
     S سباح، C مدرب، R مسؤول.
     السنة هي سنة بداية الموسم: سبتمبر–ديسمبر = السنة، جانفي–أوت = السابقة.
     الفئة: 1 أكابر، 2 أصاغر، 0 مسؤولون.

   التوليد في الخادم، لأن التسلسل يُقرأ من القاعدة ولا يجوز أن يتكرر بين
   جهازين. وهذه الطبقة لا تُنشئ أرقامًا: تُصلح العرض والبطاقات والملف الشخصي
   حتى لا يظهر رقم قديم بصيغة `SDR-` أو `COACH-` بعد الترقيم.
   ========================================================================= */
/* الرقم المطبوع في الاستمارة: لا رقم انخراط قبل الاعتماد، والشرطة أصدق من
   رقم تطبيقي يُظنّ أنه رقم انخراط. */
function memberNoFor(a) {
  const no = String((a && a.membership_no) || '').trim();
  return /^[SCR][0-9]{4}[012][0-9]{4}$/.test(no) ? no : (no || '—');
}

(function () {
  'use strict';

  const MEMBER_NO = /^[SCR][0-9]{4}[012][0-9]{4}$/;
  const isMemberNo_ = v => MEMBER_NO.test(String(v || '').trim());
  const seasonStart_ = date => {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return new Date().getFullYear();
    return (d.getMonth() + 1) >= 9 ? d.getFullYear() : d.getFullYear() - 1;
  };

  /* البطاقة الرسمية للمدرب: رقمه من ملفه أو حسابه، لا رقم مُختلق. */
  const coreCoachCardMembership = coachCardModel;
  coachCardModel = function (c) {
    const model = coreCoachCardMembership.apply(this, arguments);
    const no = String((c && (c.membership_no || c.member_no)) || '').trim();
    model.membership_no = isMemberNo_(no) ? no : '—';
    return model;
  };

  /* بطاقة المسؤول: `member_no` من الحساب. ومعرّف الحساب ليس رقم انخراط، فلا
     يُعرض في خانة الرقم. */
  const coreStaffCardMembership = staffCardModel;
  staffCardModel = function (u) {
    const model = coreStaffCardMembership.apply(this, arguments);
    model.membership_no = isMemberNo_(model.membership_no) ? model.membership_no : '—';
    return model;
  };

  /* الملف الشخصي: رقم الحساب أولًا، ثم رقم السباح، ولا معرّف داخلي. */
  const coreMyProfileMembership = myProfile;
  myProfile = function () {
    const p = coreMyProfileMembership.apply(this, arguments);
    const u = state.user || {};
    const me = (typeof mySwimmer === 'function') ? mySwimmer() : null;
    const no = String(p.member_no || u.member_no || (me && me.membership_no) || '').trim();
    p.member_no = isMemberNo_(no) ? no : (isMemberNo_(u.member_no) ? u.member_no : '—');
    return p;
  };

  /* بطاقة قواعد الترقيم في الإعدادات: تذكير دائم بالصيغة والموسم الجاري. */
  function membershipRulesPanel_() {
    const season = seasonStart_();
    return '<section class="panel membership-legend">'
      + '<div class="panel-head"><div><h3>ترقيم الانخراط</h3>'
      + '<p>رقم واحد من عشر خانات لكل منخرط، يتغيّر طرفه الأول بتغيّر صفته.</p></div></div>'
      + '<div class="membership-rules">'
      + '<div><b dir="ltr">S' + season + '2 0001</b><span>سباح أصغر من 18 سنة</span></div>'
      + '<div><b dir="ltr">S' + season + '1 0001</b><span>سباح 18 سنة فما فوق</span></div>'
      + '<div><b dir="ltr">C' + season + '1 0001</b><span>مدرب</span></div>'
      + '<div><b dir="ltr">R' + season + '0 0001</b><span>مسؤول (تسلسل تراكمي)</span></div>'
      + '</div>'
      + '<p class="hint">السنة هي سنة بداية الموسم: من سبتمبر إلى ديسمبر هي السنة نفسها، '
      + 'ومن جانفي إلى أوت هي السنة السابقة. وتسلسل المسؤولين لا يُصفَّر مع الموسم.</p>'
      + '</section>';
  }

  const corePageSettingsMembership = pageSettings;
  pageSettings = function () {
    return corePageSettingsMembership.apply(this, arguments) + membershipRulesPanel_();
  };
})();

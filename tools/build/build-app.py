import io, os, re, shutil, sys
tmp = r"G:\التطبيقات والبرام\الصدارة\02\tools\build"
g = io.open(tmp + r"\part-g.js", encoding="utf-8").read()
gconst = "\n".join(l for l in g.split("\n")
                   if re.match(r"^(const (CLUB_AR|CLUB_FR|CLUB_MOTTO|STAR|ORNAMENT)\s*=)", l))

base = io.open(tmp + r"\baseline-201e0c8.js", encoding="utf-8").read().rstrip()

# drop the provably-dead legacy builders and the duplicate form writers
sys.path.insert(0, tmp)
from prune import prune as _prune
base, _dropped = _prune(base)
print("pruned %d chars of dead legacy code from the baseline" % _dropped)

# apply the bare print mode to the baseline printArea
h0 = base.index("  const head=document.createElement('header');")
h1 = base.index("  host.appendChild(head);") + len("  host.appendChild(head);")
f0 = base.index("  host.insertAdjacentHTML('beforeend','<footer")
head_new = """  const bare = options.bare === true;
  if (!bare) {
    const head=document.createElement('header');
    head.className='print-head';
    head.innerHTML='<div class="print-head-main"><b>'+esc(CLUB.name)+' \u2014 '+esc(CLUB.unit)+'</b><span class="print-head-title">'+esc(options.title||'\u062a\u0642\u0631\u064a\u0631')+'</span>'+(options.sub?'<span class="print-head-sub">'+esc(options.sub)+'</span>':'')+'</div>'
      +'<div class="print-head-side"><span>\u0627\u0644\u0645\u0648\u0633\u0645 '+esc(CLUB.season)+'</span><span>'+esc(options.date||longDate())+'</span></div>';
    host.appendChild(head);
  }
  const body=document.createElement('div');
  body.className='print-body'+(options.variant?' print-'+options.variant:'');
  while(node.firstChild) body.appendChild(node.firstChild);"""
foot_new = """  if (!bare) host.insertAdjacentHTML('beforeend','<footer class="print-foot"><span>'+esc(CLUB.address)+' \u2014 \u062a\u0644\u0641: <span dir="ltr">'+esc(CLUB.phone)+'</span></span><span>'+esc(CLUB.email)+'</span></footer>');
  host.classList.add(options.variant ? 'print-'+options.variant : 'print-plain');"""
base = base[:h0] + head_new + base[h1:f0] + foot_new + base[base.index("\n", f0):]
assert base.count("{") == base.count("}"), (base.count("{"), base.count("}"))

# the baseline kicked boot() off mid-file, so the first paint used the legacy page
KICK = "\nboot();\n"
assert base.count(KICK) == 1, base.count(KICK)
base = base.replace(KICK, "\n", 1)

base = base.replace("const save = () => localStorage.setItem('sadara-state', JSON.stringify(state));",
                    "let save = () => localStorage.setItem('sadara-state', JSON.stringify(state));")
# accessible names for the icon buttons
base = base.replace('<button class="icon-btn" data-action="theme">',
                    '<button class="icon-btn" data-action="theme" aria-label="\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a" title="\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0648\u0636\u0639">')
base = base.replace('<button class="icon-btn notification">',
                    '<button class="icon-btn notification" data-action="notification" aria-label="\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a" title="\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a">')
base = base.replace('<button class="close" data-action="close">\u00d7</button>',
                    '<button class="close" data-action="close" aria-label="\u0625\u063a\u0644\u0627\u0642">\u00d7</button>')
base = base.replace('<div class="modal-backdrop"><div class="modal auth-modal">',
                    '<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644"><div class="modal auth-modal">')
base = base.replace('<div class="modal-backdrop"><div class="modal registration-modal">',
                    '<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal registration-modal">')
# nav entry for the audit page
base = base.replace("['card','\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0627\u0646\u062e\u0631\u0627\u0637']].map",
                    "['card','\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0627\u0646\u062e\u0631\u0627\u0637'],['audit','\u0633\u062c\u0644 \u0627\u0644\u062a\u062f\u0642\u064a\u0642']].map")
assert "aria-label" in base and "bare = options.bare" in base and "سجل التدقيق" in base

order = ["part-h.js","part-i.js","part-j.js","part-k.js","part-l.js","part-m.js","part-n.js","part-p.js","part-s.js","part-t.js","part-u.js","part-v.js","part-q.js"]
layers = [gconst] + [io.open(tmp + "\\" + n, encoding="utf-8").read().rstrip() for n in order]
out = base + "\n\n/* ---------- layers added after the baseline commit ---------- */\n\n" + "\n\n".join(layers)
out = out.rstrip() + "\n\n/* ---------- final layer ---------- */\n\n" + io.open(tmp + r"\part-r.js", encoding="utf-8").read().rstrip() + "\n"
assert out.count("{") == out.count("}"), (out.count("{"), out.count("}"))
decl = re.findall(r"^(?:const|let|var)\s+([A-Za-z_$][\w$]*)", out, re.M)
assert not sorted({d for d in decl if decl.count(d) > 1})
# Two function declarations of the same name silently resolve to the later one,
# which is how a whole layer of edits ended up being dead code. Catch it here.
fn = re.findall(r"^function\s+([A-Za-z_$][\w$]*)", out, re.M)
dupes = sorted({f for f in fn if fn.count(f) > 1})
if dupes:
    msg = "declared twice, the later copy wins: " + ", ".join(dupes)
    if os.environ.get("SADARA_BUILD_WARN_DUPES"):
        print("WARNING: " + msg)
    else:
        raise AssertionError(msg)
io.open(tmp + r"\..\..\app.js", "w", encoding="utf-8", newline="").write(out)

# The deployable copy is what Firebase serves and what every test loads, so a
# build that leaves it behind would publish and test yesterday's code.
shutil.copyfile(tmp + r"\..\..\app.js", tmp + r"\..\..\firebase-public\app.js")

print("rebuilt:", out.count("\n") + 1, "lines | no duplicate declarations | braces balanced")
print("synced:  app.js -> firebase-public/app.js")

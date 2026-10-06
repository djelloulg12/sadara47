/**
 * Reports whether this machine can reach the Firebase endpoints at all.
 *
 * TLS inspection by antivirus software breaks every Node tool on the box, and
 * the error it produces says nothing about the cause. This script finds the
 * intercepting root, hands it to Node, and then probes the endpoints, so a
 * failed deploy says which layer is at fault.
 *
 *   node tools/check-network.js
 *
 * Node only reads NODE_EXTRA_CA_CERTS when the process starts, so the probe
 * runs in a child process with the variable already set.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const CA = path.join(HERE, 'intercept-roots.pem');
const WRAPPER = path.join(HERE, 'firebase.ps1');

const ENDPOINTS = [
  ['auth.firebase.tools', 'https://auth.firebase.tools/attest'],
  ['firebase.google.com', 'https://firebase.google.com/'],
  ['console.firebase.google.com', 'https://console.firebase.google.com/'],
  ['firestore.googleapis.com', 'https://firestore.googleapis.com/']
];

let bad = 0;

function line(ok, text, hint) {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + text
    + (ok || !hint ? '' : '\n         ' + hint));
}

// --- find the intercepting roots (one place knows how) --------------------
function exportRoots() {
  const res = spawnSync('powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', WRAPPER, '-ExportOnly'],
    { encoding: 'utf8' });
  (res.stdout || '').split(/\r?\n/)
    .forEach(l => { if (l.trim()) console.log('  ' + l.trim()); });
  return fs.existsSync(CA);
}

const haveBundle = exportRoots();

// --- Node reads NODE_EXTRA_CA_CERTS at start, so re-run in a child --------
if (haveBundle && process.env.NODE_EXTRA_CA_CERTS !== CA && process.env.SADARA_PROBE !== '1') {
  const res = spawnSync(process.execPath, [__filename], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { NODE_EXTRA_CA_CERTS: CA, SADARA_PROBE: '1' })
  });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  process.exit(res.status === null ? 1 : res.status);
}

async function probe() {
  console.log('Sadara — network and certificate check');
  console.log('');

  if (fs.existsSync(CA)) {
    line(true, 'intercepting roots in use: ' + path.basename(CA)
      + ' (' + fs.statSync(CA).size + ' bytes)');
  } else {
    line(true, 'no interception bundle; using the built-in trust store');
  }

  for (const [name, url] of ENDPOINTS) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      line(true, name + ' reachable (HTTP ' + res.status + ')');
    } catch (e) {
      const code = (e.cause && e.cause.code) || e.code || '';
      const hint = /CERT/i.test(String(code) + e.message)
        ? 'antivirus is inspecting TLS; npm run login exports the root and handles it'
        : code === 'ENOTFOUND'
          ? 'DNS could not resolve the host'
          : 'check the connection and try again';
      line(false, name + ' unreachable: ' + (code || e.message), hint);
    }
  }

  console.log('');
  console.log(bad
    ? bad + ' endpoint(s) blocked — see the hints above'
    : 'every Firebase endpoint answered, TLS is trusted');
  console.log('');
  console.log('Next step, once this is clean:');
  console.log('  npm run login     one command, opens the browser');
  console.log('  npm run deploy    check + publish site and security rules');
  process.exit(bad ? 1 : 0);
}

probe();
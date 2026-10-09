// Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) usando solo WebCrypto.
// Funciona igual en Deno (Supabase Edge Functions) y en Node 18+ (para pruebas).
const te = new TextEncoder();
export const b64u = {
  enc(buf) { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ""; for (const x of b) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec(str) { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); },
};
const cat = (...a) => { const n = a.reduce((k, x) => k + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key, data) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", k, data)); }
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, len);

/** Crea un par de claves VAPID nuevo. Devuelve {publicKey (b64url, 65 bytes), privateJwk}. */
export async function generateVapid() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64u.enc(pub), privateJwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d } };
}

/** Cifra el mensaje para una suscripción (RFC 8291). `fixed` solo se usa en pruebas con el vector oficial. */
export async function encrypt(payload, p256dh, authSecret, fixed) {
  const uaPub = b64u.dec(p256dh), auth = b64u.dec(authSecret);
  let asPriv, asPub;
  if (fixed) {
    asPub = b64u.dec(fixed.asPublic);
    asPriv = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u.enc(asPub.slice(1, 33)), y: b64u.enc(asPub.slice(33, 65)), d: fixed.asPrivate }, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPriv = kp.privateKey; asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(auth, ecdh, cat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = fixed ? b64u.dec(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const data = typeof payload === "string" ? te.encode(payload) : payload;
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(data, new Uint8Array([2]))));
  const rs = 4096, hdr = new Uint8Array(21); hdr.set(salt, 0); new DataView(hdr.buffer).setUint32(16, rs); hdr[20] = asPub.length;
  return cat(hdr, asPub, ct);
}

/** Encabezado Authorization VAPID (JWT ES256). */
export async function vapidAuth(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const h = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(h + "." + c)));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${vapid.publicKey}`;
}

/** Envía una notificación. Devuelve el código HTTP del servicio de push (201 = ok; 404/410 = suscripción vencida). */
export async function sendPush(sub, payloadObj, vapid, subject) {
  const body = await encrypt(JSON.stringify(payloadObj), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, { method: "POST", body, headers: {
    Authorization: await vapidAuth(sub.endpoint, vapid, subject), "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" } });
  return r.status;
}

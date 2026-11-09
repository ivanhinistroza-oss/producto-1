// ---------- Firebase: cuentas, negocios y datos compartidos ----------
// La configuración web de Firebase no es secreta: lo que protege los datos son las reglas (firestore.rules).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAT7Dy8QCsPg04ga7set8rDlrLSLOl6qt0",
  authDomain: "producto-1-5a3c5.firebaseapp.com",
  projectId: "producto-1-5a3c5",
  storageBucket: "producto-1-5a3c5.firebasestorage.app",
  messagingSenderId: "554891558363",
  appId: "1:554891558363:web:47cb29f5532571b4c6bbfe",
};
const FB_SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const INVITE_HOURS = 48;
let fb = null;
let fbUnsubs = [];
let fbInvitaciones = [];
let fbNombrePendiente = "";

async function cargarFirebase() {
  const [appMod, A, F] = await Promise.all([
    import(FB_SDK + "firebase-app.js"),
    import(FB_SDK + "firebase-auth.js"),
    import(FB_SDK + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  let fs;
  // la caché persistente deja vender sin internet; si el navegador no la permite, se usa solo memoria
  try {
    fs = F.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch {
    fs = F.getFirestore(app);
  }
  const auth = A.getAuth(app);
  auth.languageCode = "es";
  return { A, F, auth, fs, negocioId: null, dueno: null, invUnsub: null };
}
function fbTrack(unsub) { fbUnsubs.push(unsub); return unsub; }
function fbDetener() {
  fbUnsubs.forEach(u => { try { u(); } catch {} });
  fbUnsubs = [];
  fbInvitaciones = [];
  webCat = null; clearTimeout(webTimer);
  if (fb) { fb.invUnsub = null; fb.negocioId = null; fb.dueno = null; }
  db = null; sessionId = null;
  S.products = []; S.notes = []; S.users = []; S.quotes = []; S.cajas = []; cajasBlocked = false; salesRangoCache.clear(); S.loaded = false;
  notasDesde = null; notasInicio = null; notasEscuchar = null; notasFolioMax = 0; notasDeCache = false;
  S.settings = { negocio: "Mi negocio", moneda: "S/" };
}
// sin internet, Firestore guarda el cambio en este equipo y lo envía solo al volver la conexión;
// esperar la confirmación del servidor dejaría la venta colgada
function fbWrite(promise) {
  if (navigator.onLine) return promise;
  promise.catch(e => toast(failMsg(e)));
  return Promise.resolve();
}
// imita la base db de claude.ai para que el resto de la app funcione igual
function fbDb(nid) {
  const { F, fs } = fb;
  const base = "negocios/" + nid + "/";
  const wrap = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
  const docApi = path => {
    const ref = F.doc(fs, base + path);
    return {
      get: async () => wrap(await F.getDoc(ref)),
      set: body => fbWrite(F.setDoc(ref, body)),
      update: patch => fbWrite(F.updateDoc(ref, patch)),
      delete: () => fbWrite(F.deleteDoc(ref)),
      onSnapshot: (cb, err) => fbTrack(F.onSnapshot(ref, s => cb(wrap(s)), err)),
    };
  };
  return {
    doc: docApi,
    collection: name => ({
      doc: id => docApi(name + "/" + id),
      get: async () => ({ docs: (await F.getDocs(F.collection(fs, base + name))).docs.map(wrap) }),
      onSnapshot: (cb, err) => fbTrack(F.onSnapshot(F.collection(fs, base + name), s => cb({ docs: s.docs.map(wrap) }), err)),
    }),
    // para el folio basta la nota más alta; leer todas en cada venta gastaría la cuota gratis
    // notas desde una fecha (null = todas); avisa si lo que llega aún viene de la copia del equipo
    notesDesde: (desde, cb, err) => {
      const col = F.collection(fs, base + "notes");
      const q = desde ? F.query(col, F.where("fecha", ">=", desde)) : col;
      return fbTrack(F.onSnapshot(q, { includeMetadataChanges: true }, s => cb({
        docs: s.docs.map(wrap), fromCache: s.metadata.fromCache, cambios: s.docChanges().length,
      }), err));
    },
    notesRango: async (desde, hasta) => (await F.getDocs(F.query(F.collection(fs, base + "notes"), F.where("fecha", ">=", desde), F.where("fecha", "<", hasta)))).docs.map(d => ({ id: d.id, ...d.data() })),
    notesServidor: async () => ({ docs: (await F.getDocsFromServer(F.collection(fs, base + "notes"))).docs.map(wrap) }),
    // cada cierre es un documento: se escuchan solo los últimos para que el historial no encarezca cada apertura
    cajasRecientes: (cb, err) => fbTrack(F.onSnapshot(F.query(F.collection(fs, base + "cajas"), F.orderBy("abiertaEn", "desc"), F.limit(60)), s => cb({ docs: s.docs.map(wrap) }), err)),
    cajasServidor: async () => ({ docs: (await F.getDocsFromServer(F.collection(fs, base + "cajas"))).docs.map(wrap) }),
    lastNotes: async () => {
      const q = F.query(F.collection(fs, base + "notes"), F.orderBy("folio", "desc"), F.limit(1));
      return (await F.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
    },
  };
}

const { DEMO_MODE, firebaseConfig, INTERNAL_EMAIL_DOMAIN } = window.APP_CONFIG;


const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const POSITION_TYPES = ["SE","CAE","Técnico","Validador","Técnico de Voz y Datos"];
const ACTIVITY_CATALOGS = window.ACTIVITY_CATALOGS || {};

const DEMO_SETTINGS = {
  unit:"Junta Distrital Ejecutiva 33 del Instituto Nacional Electoral en el Estado de México",
  contractStart:"2023-11-01",
  contractEnd:"2023-12-31",
  genericActivity:"Registrar, procesar y validar la información que se genera en los diversos sistemas informáticos que integran el multisistema ELEC y ELEC MOVIL, correspondiente al proceso de reclutamiento y seguimiento de supervisoras/es electorales (SE) y capacitadoras/es-asistentes electorales (CAE) de las actividades que desarrollan las y los SE y CAE, así como el proceso de integración de mesas directivas de casilla y de la capacitación electoral.",
  positions:{
    "SE":ACTIVITY_CATALOGS.SE || {genericActivity:"",developedActivities:[]},
    "CAE":ACTIVITY_CATALOGS.CAE || {genericActivity:"",developedActivities:[]},
    "Técnico":ACTIVITY_CATALOGS["Técnico"] || {genericActivity:"",developedActivities:[]},
    "Técnico de Voz y Datos":ACTIVITY_CATALOGS["Técnico de Voz y Datos"] || {genericActivity:"",developedActivities:[]},
    "Validador":ACTIVITY_CATALOGS.Validador || {
      genericActivity:"Registrar, procesar y validar la información que se genera en los diversos sistemas informáticos que integran el multisistema ELEC y ELEC MOVIL, correspondiente al proceso de reclutamiento y seguimiento de supervisoras/es electorales (SE) y capacitadoras/es-asistentes electorales (CAE) de las actividades que desarrollan las y los SE y CAE, así como el proceso de integración de mesas directivas de casilla y de la capacitación electoral.",
      developedActivities:[]
    }
  },
  reviewer:"Lic. Esthela Del Carmen Torres Rivera",
  reviewerRole:"Firma del Servidor Público"
};
const DEMO_USERS = [
  {uid:"demo-karla",username:"karla",password:"123456",name:"Karla Villegas Arana",code:"27C3082",contract:"PE-HE-15153300000-F0386941-385826-3",position:"Validador",role:"user",active:true},
  {uid:"demo-admin",username:"admin",password:"admin123",name:"Administrador",code:"ADMIN",contract:"—",position:"Validador",role:"admin",active:true}
];

let firebase = null;
const DEMO_USERS_STORAGE_KEY="informeDemoUsersV1";
const DEMO_PASSWORD_ITERATIONS=210000;
let demoUserStorageError="";
let state = {
  user:null, profile:null, settings:{...DEMO_SETTINGS}, evidenceFiles:[], activities:[""], history:[],
  users:loadDemoUsers(), signedFile:null, signedReports:[]
};

function loadDemoUsers(){
  if(!DEMO_MODE) return [];
  try{
    const raw=localStorage.getItem(DEMO_USERS_STORAGE_KEY);
    if(!raw){ demoUserStorageError=""; return [...DEMO_USERS]; }
    const saved=JSON.parse(raw);
    if(saved.version!==1 || !Array.isArray(saved.users)) throw new Error("Formato no válido");
    if(saved.users.some(u=>!u || typeof u.uid!=="string" || typeof u.username!=="string" ||
      typeof u.passwordHash!=="string" || typeof u.passwordSalt!=="string" ||
      u.passwordIterations!==DEMO_PASSWORD_ITERATIONS)) throw new Error("Registro no válido");
    demoUserStorageError="";
    return [...DEMO_USERS,...saved.users.filter(u=>!DEMO_USERS.some(base=>base.username===u.username))];
  }catch(err){
    demoUserStorageError="No se pudieron leer los usuarios guardados en este navegador. No se han sobrescrito los datos.";
    return [...DEMO_USERS];
  }
}
function bytesToBase64(bytes){return btoa(String.fromCharCode(...bytes));}
function base64ToBytes(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
async function demoPasswordHash(password,salt,iterations=DEMO_PASSWORD_ITERATIONS){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
  return new Uint8Array(bits);
}
async function verifyDemoPassword(user,password){
  if(!user || user.active===false) return false;
  // Las dos cuentas incluidas con la demostración siguen siendo compatibles.
  if(DEMO_USERS.some(base=>base.uid===user.uid)) return user.password===password;
  if(!user.passwordHash || !user.passwordSalt) return false;
  const expected=base64ToBytes(user.passwordHash);
  const actual=await demoPasswordHash(password,base64ToBytes(user.passwordSalt),user.passwordIterations);
  return expected.length===actual.length && actual.reduce((diff,b,i)=>diff|(b^expected[i]),0)===0;
}
async function createDemoUser(userData,password){
  if(state.profile?.role!=="admin") throw new Error("Solo el administrador puede crear usuarios.");
  if(password.length<6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const username=String(userData.username||"").trim().toLowerCase();
  if(!username) throw new Error("Captura un nombre de usuario.");
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await demoPasswordHash(password,salt);
  // Volver a leer evita descartar las altas de otra pestaña del navegador.
  const users=loadDemoUsers();
  if(demoUserStorageError) throw new Error(demoUserStorageError);
  if(users.some(u=>u.username===username)) throw new Error("Ese nombre de usuario ya existe.");
  const {password:ignoredPassword,...profile}=userData;
  const user={...profile,uid:"demo-"+crypto.randomUUID(),username,passwordHash:bytesToBase64(hash),passwordSalt:bytesToBase64(salt),passwordIterations:DEMO_PASSWORD_ITERATIONS};
  const next=[...users,user];
  const saved=next.filter(u=>!DEMO_USERS.some(base=>base.uid===u.uid));
  try{localStorage.setItem(DEMO_USERS_STORAGE_KEY,JSON.stringify({version:1,users:saved}));}
  catch{throw new Error("No se pudo guardar el usuario en este navegador. Comprueba el espacio y los permisos de almacenamiento.");}
  state.users=next;
  return user;
}

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove("show"),2700); }
function safe(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function fileSize(n){ if(n<1024)return n+" B"; if(n<1024**2)return (n/1024).toFixed(1)+" KB"; return (n/1024**2).toFixed(1)+" MB"; }
function usernameEmail(username){
  const value=String(username||"").trim().toLowerCase();
  const suffix="@"+INTERNAL_EMAIL_DOMAIN;
  const local=value.endsWith(suffix)?value.slice(0,-suffix.length):value;
  if(!/^[a-z0-9._-]+$/.test(local)) throw new Error("Escribe tu usuario o el correo interno asignado, sin espacios.");
  return local+suffix;
}

async function initFirebase(){
  if(DEMO_MODE) return;
  const appMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
  const fsMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  const stMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js");
  const secondary = appMod.initializeApp(firebaseConfig, "secondary");
  const main = appMod.initializeApp(firebaseConfig);
  firebase = {
    main, secondary,
    auth:authMod.getAuth(main), secondaryAuth:authMod.getAuth(secondary),
    db:fsMod.getFirestore(main), storage:stMod.getStorage(main),
    ...authMod, ...fsMod, ...stMod
  };
  firebase.onAuthStateChanged(firebase.auth, async (user)=>{
    if(!user){showLogin();return;}
    try{await loadFirebaseProfile(user);showApp();}
    catch(err){
      console.error("No se pudo cargar el perfil:",err);
      try{await firebase.signOut(firebase.auth);}catch{}
      showLogin();toast(authErrorMessage(err));
    }
  });
}
async function loadFirebaseProfile(user){
  state.user=user;
  const snap=await firebase.getDoc(firebase.doc(firebase.db,"users",user.uid));
  if(!snap.exists()) throw new Error("El usuario no tiene perfil.");
  state.profile={uid:user.uid,...snap.data()};
  if(state.profile.active!==true) throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
  const s=await firebase.getDoc(firebase.doc(firebase.db,"config","institution"));
  if(s.exists()) state.settings={...DEMO_SETTINGS,...s.data()};
  await loadHistory();
}
function authErrorMessage(err){
  const messages={
    "auth/invalid-credential":"Usuario o contraseña incorrectos.",
    "auth/user-not-found":"Usuario o contraseña incorrectos.",
    "auth/wrong-password":"Usuario o contraseña incorrectos.",
    "auth/email-already-in-use":"Ese usuario ya existe.",
    "auth/weak-password":"Usa una contraseña de al menos 6 caracteres.",
    "auth/too-many-requests":"Se hicieron demasiados intentos. Espera unos minutos y vuelve a intentar.",
    "auth/network-request-failed":"No se pudo conectar. Revisa tu conexión a internet.",
    "permission-denied":"No tienes permiso para realizar esta operación. Contacta al administrador."
  };
  return messages[err?.code] || err?.message || "No se pudo completar la operación.";
}
async function createFirebaseUser(userData,password){
  if(state.profile?.role!=="admin") throw new Error("Solo el administrador puede crear usuarios.");
  const username=String(userData.username||"").trim().toLowerCase();
  if(!/^[a-z0-9._-]+$/.test(username)) throw new Error("El usuario solo puede llevar letras sin acentos, números, puntos, guiones o guion bajo.");
  let created=null;
  try{
    created=await firebase.createUserWithEmailAndPassword(firebase.secondaryAuth,usernameEmail(username),password);
    await firebase.setDoc(firebase.doc(firebase.db,"users",created.user.uid),{...userData,username});
    return created.user.uid;
  }catch(err){
    if(created){try{await firebase.deleteUser(created.user);}catch(rollbackError){console.error("No se pudo revertir un alta incompleta:",rollbackError);}}
    throw err;
  }finally{await firebase.signOut(firebase.secondaryAuth);}
}
function showLogin(){
  state.user=null; state.profile=null;
  state.activities=[""]; state.evidenceFiles=[]; state.signedFile=null;
  state.history=[]; state.signedReports=[];
  $("#adminTab").classList.add("hidden");
  $("#adminBtn").classList.add("hidden"); $("#adminTabButton").classList.add("hidden");
  $("#usersTable tbody").innerHTML="";
  $("#previewModal").classList.add("hidden"); $("#reportPreview").innerHTML="";
  $("#password").value="";
  showTab("formTab");
  $("#loginView").classList.remove("hidden"); $("#appView").classList.add("hidden");
}
function showApp(){
  state.activities=[""]; state.evidenceFiles=[]; state.signedFile=null;
  $("#evidenceInput").value=""; $("#signedFileInput").value="";
  $("#previewModal").classList.add("hidden"); $("#reportPreview").innerHTML="";
  showTab("formTab");
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  renderProfile(); renderActivities(); renderEvidence(); renderHistory(); renderSignedSection(); renderAdmin();
}
function normalizePosition(pos){
  const key=String(pos||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const aliases={
    "se":"SE", "supervisor electoral":"SE",
    "cae":"CAE", "capacitador-asistente electoral":"CAE",
    "tecnico":"Técnico", "tecnico en capacitacion electoral":"Técnico", "tecnico/a en capacitacion electoral":"Técnico",
    "validador":"Validador", "validador de captura":"Validador", "validador/a de captura":"Validador",
    "tecnico de voz y datos":"Técnico de Voz y Datos", "tecnico/a de voz y datos":"Técnico de Voz y Datos"
  };
  return aliases[key] || String(pos||"").trim();
}
function currentPosition(){
  return normalizePosition(state.profile?.position || "Validador");
}
function positionLabel(pos=currentPosition()){
  pos=normalizePosition(pos);
  if(ACTIVITY_CATALOGS[pos]?.label) return ACTIVITY_CATALOGS[pos].label;
  return ({
    "SE":"Supervisor Electoral",
    "CAE":"Capacitador-Asistente Electoral",
    "Técnico":"Técnico",
    "Validador":"Validador de Captura"
  })[pos] || pos;
}
function positionConfig(pos){
  pos=normalizePosition(pos);
  let configured=state.settings?.positions?.[pos] || {};
  const defaults=DEMO_SETTINGS.positions[pos] || {};
  // Los catálogos anteriores al procedimiento se sustituyen al leerlos, sin escribir en Firestore.
  // Las personalizaciones guardadas desde esta versión conservan su prioridad.
  if(defaults.catalogVersion && configured.catalogVersion!==defaults.catalogVersion) configured=defaults;
  const activities=Array.isArray(configured.developedActivities)
    ? configured.developedActivities.filter(a=>typeof a==="string" && a.trim())
    : [];
  return {
    genericActivity:configured.genericActivity || defaults.genericActivity || state.settings?.genericActivity || "",
    developedActivities:activities.length ? activities : (defaults.developedActivities || [])
  };
}
function currentPositionConfig(){
  return positionConfig(currentPosition());
}
function genericActivityTitle(){
  const pos=currentPosition();
  if(pos==="Validador") return "Actividad Genérica del Validador de Captura";
  if(pos==="Técnico") return "Actividad Genérica del Técnico en Capacitación Electoral";
  return "Actividad Genérica del "+positionLabel(pos);
}
function renderActivityCatalog(){
  const select=$("#activityCatalogSelect");
  if(!select) return;
  const list=currentPositionConfig().developedActivities;
  select.innerHTML='<option value="">Selecciona una actividad del catálogo</option>'+list.map((a,i)=>'<option value="'+i+'">'+safe(a)+'</option>').join("");
  select.disabled=list.length===0;
  $("#addCatalogActivityBtn").disabled=list.length===0;
  const help=$("#activityCatalogHelp");
  if(help) help.textContent=list.length ? "Selecciona una actividad y agrégala al informe. También puedes capturar actividades manualmente." : "El catálogo de actividades para este puesto está pendiente de configurar.";
}
function renderProfile(){
  const p=state.profile, s=state.settings;
  $("#welcomeTitle").textContent=`Hola, ${p.name}`;
  $("#userCodeBadge").textContent=`Código ${p.code}`;
  $("#fName").textContent=p.name; $("#fCode").textContent=p.code; $("#fContract").textContent=p.contract; $("#fUnit").textContent=s.unit;
  if($("#fPosition")) $("#fPosition").textContent=positionLabel();
  $("#genericActivity").textContent=currentPositionConfig().genericActivity || "Pendiente de configurar para este puesto."; $("#elaboroName").textContent=p.name;
  renderActivityCatalog();
  $("#reviewerName").textContent=s.reviewer; $("#reviewerRole").textContent=s.reviewerRole;
  const isAdmin=p.role==="admin"; $("#adminBtn").classList.toggle("hidden",!isAdmin); $("#adminTabButton").classList.toggle("hidden",!isAdmin);
  $("#adminTab").classList.toggle("hidden",!isAdmin);
  updatePeriodPreview();
  if($("#signedUserName")) $("#signedUserName").textContent=p.name;
  if($("#signedUserCode")) $("#signedUserCode").textContent=p.code;
}
function fillPeriodControls(){
  $("#monthSelect").innerHTML=MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join("");
  const y=new Date().getFullYear(); $("#yearSelect").innerHTML=[y-1,y,y+1].map(v=>`<option>${v}</option>`).join("");
  $("#monthSelect").value=new Date().getMonth(); $("#yearSelect").value=y;
}
function periodText(){
  const monthIndex=+$("#monthSelect").value;
  const month=MONTHS[monthIndex].toLowerCase();
  const year=+$("#yearSelect").value;
  const type=$("#periodType").value;
  const lastDay=new Date(year,monthIndex+1,0).getDate();

  if(type==="primera"){
    return `Entregable correspondiente del 01 al 15 de ${month} de ${year}`;
  }
  if(type==="segunda"){
    return `Entregable correspondiente del 16 al ${String(lastDay).padStart(2,"0")} de ${month} de ${year}`;
  }
  return `Entregable correspondiente del 01 al ${String(lastDay).padStart(2,"0")} de ${month} de ${year}`;
}

function elaborationDateText(){
  const d=new Date();
  return d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function updatePeriodPreview(){ $("#periodPreview").textContent=periodText(); }
function addCatalogActivity(){
  const select=$("#activityCatalogSelect");
  if(!select || select.value==="") return;
  const list=currentPositionConfig().developedActivities;
  const text=list[Number(select.value)];
  if(!text) return;
  const emptyIndex=state.activities.findIndex(x=>!x.trim());
  if(emptyIndex>=0) state.activities[emptyIndex]=text;
  else state.activities.push(text);
  renderActivities();
  select.value="";
}
function renderActivities(){
  $("#activitiesList").innerHTML=state.activities.map((a,i)=>`
    <div class="activity-row" data-i="${i}">
      <div class="activity-num">${i+1}</div>
      <textarea placeholder="Describe la actividad realizada...">${safe(a)}</textarea>
      <button class="icon-btn remove-activity" title="Eliminar">🗑</button>
    </div>`).join("");
  $$(".activity-row textarea").forEach((el,i)=>el.addEventListener("input",()=>state.activities[i]=el.value));
  $$(".remove-activity").forEach((b,i)=>b.addEventListener("click",()=>{ if(state.activities.length===1){state.activities=[""]; }else state.activities.splice(i,1); renderActivities(); }));
}
function renderEvidence(){
  $("#evidenceList").innerHTML=state.evidenceFiles.map((f,i)=>`
    <div class="evidence-item">
      <div class="evidence-icon">${f.type==="application/pdf"?"PDF":"IMG"}</div>
      <div class="evidence-meta"><strong>${safe(f.name)}</strong><span>${fileSize(f.size)}</span></div>
      <button class="icon-btn evidence-remove" data-i="${i}">✕</button>
    </div>`).join("");
  $$(".evidence-remove").forEach(b=>b.addEventListener("click",()=>{state.evidenceFiles.splice(+b.dataset.i,1);renderEvidence()}));
}
function addFiles(files){
  const valid=[...files].filter(f=>f.type==="application/pdf"||["image/jpeg","image/png"].includes(f.type));
  const tooBig=valid.filter(f=>f.size>20*1024*1024);
  if(tooBig.length) toast("Cada archivo debe pesar máximo 20 MB.");
  state.evidenceFiles.push(...valid.filter(f=>f.size<=20*1024*1024));
  renderEvidence();
}
function showTab(id){
  if(id==="adminTab" && state.profile?.role!=="admin") id="formTab";
  $$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));
  $$(".tab-panel").forEach(x=>x.classList.toggle("active",x.id===id));
}
function previewHTML(){
  const p=state.profile,s=state.settings;
  const acts=state.activities.filter(x=>x.trim()).map(x=>`<li>${safe(x)}</li>`).join("");
  const start=formatDate(s.contractStart), end=formatDate(s.contractEnd);
  return `<div class="paper">
    <div class="paper-header">
      <img src="assets/logo-ine-gris.png" alt="Instituto Nacional Electoral" style="width:52mm;height:auto;align-self:flex-start">
      <div class="paper-title">Informe de Actividades<br>Prestadores de Servicios Profesionales<br><span>Fecha de elaboración: ${elaborationDateText()}</span></div>
    </div>
    <table class="paper-table"><tr><td><b>Nombre del Prestador del Servicio</b><br><br><div class="paper-center">${safe(p.name)}</div></td>
    <td><b>Unidad Administrativa</b><br><br><div class="paper-center">${safe(s.unit)}</div></td>
    <td><b>Código</b><br><br><div class="paper-center">${safe(p.code)}</div></td></tr>
    <tr><td colspan="3"><b>Contrato No:</b><br><div class="paper-center">${safe(p.contract)}</div></td></tr>
    <tr><td colspan="3" class="paper-center"><b>Vigencia del Contrato</b><br>Del: ${start} &nbsp;&nbsp; Al: ${end}<br><br><b>${safe(periodText())}</b></td></tr></table>
    <div class="paper-section-title">${safe(genericActivityTitle().toLocaleUpperCase("es-MX"))}</div>
    <div class="paper-box">${safe(currentPositionConfig().genericActivity || "Pendiente de configurar para este puesto.")}</div>
    <div class="paper-section-title">ACTIVIDADES DESARROLLADAS EN EL PERIODO</div>
    <div class="paper-box paper-activities"><ul>${acts||"<li>Sin actividades capturadas</li>"}</ul></div>
    <div class="paper-signers"><div>Elaboró<strong>${safe(p.name)}</strong>El Prestador del Servicio</div>
    <div>Revisó por parte del INE<strong>${safe(s.reviewer)}</strong>${safe(s.reviewerRole)}</div></div>
    <div class="paper-legal">Firmado electrónicamente en términos de los artículos 10 y 22 del Reglamento para el Uso y Operación de la Firma Electrónica Avanzada en el Instituto Nacional Electoral</div>
  </div>`;
}
function formatDate(v){ if(!v)return "—"; const [y,m,d]=v.split("-"); return `${d}/${m}/${y}`; }






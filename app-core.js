const { DEMO_MODE, firebaseConfig, INTERNAL_EMAIL_DOMAIN } = window.APP_CONFIG;


const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const DEMO_SETTINGS = {
  unit:"33 Junta Distrital Ejecutiva del Instituto Nacional Electoral en el Estado de México",
  contractStart:"2023-11-01",
  contractEnd:"2023-12-31",
  genericActivity:"Registrar, procesar y validar la información que se genera en los diversos sistemas informáticos que integran el multisistema ELEC y ELEC MOVIL, correspondiente al proceso de reclutamiento y seguimiento de supervisoras/es electorales (SE) y capacitadoras/es-asistentes electorales (CAE) de las actividades que desarrollan las y los SE y CAE, así como el proceso de integración de mesas directivas de casilla y de la capacitación electoral.",
  reviewer:"Lic. Esthela Del Carmen Torres Rivera",
  reviewerRole:"Firma del Servidor Público"
};
const DEMO_USERS = [
  {uid:"demo-karla",username:"karla",password:"123456",name:"Karla Villegas Arana",code:"27C3082",contract:"PE-HE-15153300000-F0386941-385826-3",role:"user",active:true},
  {uid:"demo-admin",username:"admin",password:"admin123",name:"Administrador",code:"ADMIN",contract:"—",role:"admin",active:true}
];

let firebase = null;
let state = {
  user:null, profile:null, settings:{...DEMO_SETTINGS}, evidenceFiles:[], activities:[""], history:[],
  users:[...DEMO_USERS], signedFile:null, signedReports:[]
};

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove("show"),2700); }
function safe(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function fileSize(n){ if(n<1024)return n+" B"; if(n<1024**2)return (n/1024).toFixed(1)+" KB"; return (n/1024**2).toFixed(1)+" MB"; }
function usernameEmail(username){ return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"")}@${INTERNAL_EMAIL_DOMAIN}`; }

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
    if(user){ await loadFirebaseProfile(user); showApp(); }
    else showLogin();
  });
}
async function loadFirebaseProfile(user){
  state.user=user;
  const snap=await firebase.getDoc(firebase.doc(firebase.db,"users",user.uid));
  if(!snap.exists()) throw new Error("El usuario no tiene perfil.");
  state.profile={uid:user.uid,...snap.data()};
  const s=await firebase.getDoc(firebase.doc(firebase.db,"config","institution"));
  if(s.exists()) state.settings={...DEMO_SETTINGS,...s.data()};
  await loadHistory();
}
function showLogin(){ $("#loginView").classList.remove("hidden"); $("#appView").classList.add("hidden"); }
function showApp(){
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  renderProfile(); renderActivities(); renderEvidence(); renderHistory(); renderSignedSection(); renderAdmin();
}
function renderProfile(){
  const p=state.profile, s=state.settings;
  $("#welcomeTitle").textContent=`Hola, ${p.name}`;
  $("#userCodeBadge").textContent=`Código ${p.code}`;
  $("#fName").textContent=p.name; $("#fCode").textContent=p.code; $("#fContract").textContent=p.contract; $("#fUnit").textContent=s.unit;
  $("#genericActivity").textContent=s.genericActivity; $("#elaboroName").textContent=p.name;
  $("#reviewerName").textContent=s.reviewer; $("#reviewerRole").textContent=s.reviewerRole;
  const isAdmin=p.role==="admin"; $("#adminBtn").classList.toggle("hidden",!isAdmin); $("#adminTabButton").classList.toggle("hidden",!isAdmin);
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
  $$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));
  $$(".tab-panel").forEach(x=>x.classList.toggle("active",x.id===id));
}
function previewHTML(){
  const p=state.profile,s=state.settings;
  const acts=state.activities.filter(x=>x.trim()).map(x=>`<li>${safe(x)}</li>`).join("");
  const start=formatDate(s.contractStart), end=formatDate(s.contractEnd);
  return `<div class="paper">
    <div class="paper-header">
      <div class="paper-logo-placeholder"><b>INE</b><span>Instituto Nacional Electoral</span></div>
      <div class="paper-title">Informe de Actividades<br>Prestadores de Servicios Profesionales<br><span>Fecha de elaboración: ${elaborationDateText()}</span></div>
    </div>
    <table class="paper-table"><tr><td><b>Nombre del Prestador del Servicio</b><br><br><div class="paper-center">${safe(p.name)}</div></td>
    <td><b>Unidad Administrativa</b><br><br><div class="paper-center">${safe(s.unit)}</div></td>
    <td><b>Código</b><br><br><div class="paper-center">${safe(p.code)}</div></td></tr>
    <tr><td colspan="3"><b>Contrato No:</b><br><div class="paper-center">${safe(p.contract)}</div></td></tr>
    <tr><td colspan="3" class="paper-center"><b>Vigencia del Contrato</b><br>Del: ${start} &nbsp;&nbsp; Al: ${end}<br><br><b>${safe(periodText())}</b></td></tr></table>
    <div class="paper-section-title">Actividad Genérica del Validador de Captura</div>
    <div class="paper-box">${safe(s.genericActivity)}</div>
    <div class="paper-section-title">Actividades Desarrolladas en el Periodo</div>
    <div class="paper-box paper-activities"><ul>${acts||"<li>Sin actividades capturadas</li>"}</ul></div>
    <div class="paper-signers"><div>Elaboró<strong>${safe(p.name)}</strong>El Prestador del Servicio</div>
    <div>Revisó por parte del INE<strong>${safe(s.reviewer)}</strong>${safe(s.reviewerRole)}</div></div>
  </div>`;
}
function formatDate(v){ if(!v)return "—"; const [y,m,d]=v.split("-"); return `${d}/${m}/${y}`; }


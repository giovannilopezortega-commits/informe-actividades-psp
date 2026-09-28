async function saveFirebaseReport(blob,fileName,activities){
  const uid=state.user.uid, ts=Date.now(), path=`reports/${uid}/${$("#yearSelect").value}/${String(+$("#monthSelect").value+1).padStart(2,"0")}/${ts}_${fileName}`;
  const ref=firebase.ref(firebase.storage,path); await firebase.uploadBytes(ref,blob,{contentType:"application/pdf"});
  const url=await firebase.getDownloadURL(ref);
  const evidences=[];
  for(const f of state.evidenceFiles){
    const ep=`evidence/${uid}/${ts}/${Date.now()}_${slug(f.name)}.${f.name.split(".").pop()}`;
    const er=firebase.ref(firebase.storage,ep); await firebase.uploadBytes(er,f,{contentType:f.type}); evidences.push({name:f.name,path:ep,type:f.type});
  }
  await firebase.addDoc(firebase.collection(firebase.db,"reports"),{
    uid,name:state.profile.name,code:state.profile.code,period:periodText(),month:+$("#monthSelect").value+1,year:+$("#yearSelect").value,
    activities,createdAt:firebase.serverTimestamp(),fileName,pdfPath:path,pdfUrl:url,evidences
  });
  await loadHistory(); renderHistory(); toast("Informe guardado y PDF generado.");
  const a=document.createElement("a");a.href=url;a.target="_blank";a.click();
}
async function loadHistory(){
  if(DEMO_MODE){ state.history=JSON.parse(localStorage.getItem("demoHistory")||"[]"); return; }
  let q=firebase.query(firebase.collection(firebase.db,"reports"),firebase.where("uid","==",state.user.uid),firebase.orderBy("createdAt","desc"));
  const snap=await firebase.getDocs(q);state.history=snap.docs.map(d=>({id:d.id,...d.data()}));
}
function renderHistory(){
  const rows=state.history;
  $("#historyEmpty").classList.toggle("hidden",rows.length>0);$("#historyTable").classList.toggle("hidden",rows.length===0);
  $("#historyTable tbody").innerHTML=rows.map(r=>{
    const d=r.createdAt?.toDate?r.createdAt.toDate():new Date(r.createdAt);
    const count=Array.isArray(r.activities)?r.activities.length:r.activities;
    return `<tr><td>${safe(r.period||"—")}</td><td>${isNaN(d)? "—":d.toLocaleString("es-MX")}</td><td>${count||0}</td><td>${r.pdfUrl?`<a href="${r.pdfUrl}" target="_blank">Abrir PDF</a>`:safe(r.fileName||"PDF descargado")}</td></tr>`
  }).join("");
}
function renderAdmin(){
  if(!state.profile||state.profile.role!=="admin")return;
  const s=state.settings;$("#sUnit").value=s.unit||"";$("#sStart").value=s.contractStart||"";$("#sEnd").value=s.contractEnd||"";$("#sGeneric").value=s.genericActivity||"";$("#sReviewer").value=s.reviewer||"";$("#sReviewerRole").value=s.reviewerRole||"";
  renderUsersTable();
}
async function loadUsers(){
  if(DEMO_MODE)return;
  const snap=await firebase.getDocs(firebase.collection(firebase.db,"users"));state.users=snap.docs.map(d=>({uid:d.id,...d.data()}));renderUsersTable();
}
function renderUsersTable(){
  $("#usersTable tbody").innerHTML=state.users.map(u=>`<tr><td>${safe(u.name)}</td><td>${safe(u.username)}</td><td>${safe(u.code)}</td><td>${safe(u.contract)}</td><td>${safe(u.role)}</td><td>${u.active===false?"Inactivo":"Activo"}</td></tr>`).join("");
}
async function createUser(e){
  e.preventDefault();
  const userData={name:$("#aName").value.trim(),username:$("#aUsername").value.trim().toLowerCase(),code:$("#aCode").value.trim(),contract:$("#aContract").value.trim(),role:$("#aRole").value,active:true};
  const pwd=$("#aPassword").value;
  if(DEMO_MODE){state.users.push({uid:"demo-"+Date.now(),password:pwd,...userData});renderUsersTable();e.target.reset();toast("Usuario creado en modo demostración.");return;}
  const cred=await firebase.createUserWithEmailAndPassword(firebase.secondaryAuth,usernameEmail(userData.username),pwd);
  await firebase.setDoc(firebase.doc(firebase.db,"users",cred.user.uid),userData);await firebase.signOut(firebase.secondaryAuth);
  await loadUsers();e.target.reset();toast("Usuario creado.");
}
async function saveSettings(e){
  e.preventDefault(); const data={unit:$("#sUnit").value.trim(),contractStart:$("#sStart").value,contractEnd:$("#sEnd").value,genericActivity:$("#sGeneric").value.trim(),reviewer:$("#sReviewer").value.trim(),reviewerRole:$("#sReviewerRole").value.trim()};
  state.settings=data;
  if(!DEMO_MODE)await firebase.setDoc(firebase.doc(firebase.db,"config","institution"),data,{merge:true});
  renderProfile();toast("Configuración guardada.");
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); const username=$("#username").value.trim().toLowerCase(),pwd=$("#password").value;
  try{
    if(DEMO_MODE){
      const u=state.users.find(x=>x.username===username&&x.password===pwd&&x.active!==false);if(!u)throw new Error("Usuario o contraseña incorrectos.");
      state.user={uid:u.uid};state.profile={...u};state.history=JSON.parse(localStorage.getItem("demoHistory")||"[]");showApp();
    }else await firebase.signInWithEmailAndPassword(firebase.auth,usernameEmail(username),pwd);
  }catch(err){toast(err.message||"No fue posible iniciar sesión.");}
});
$("#togglePassword").addEventListener("click",()=>$("#password").type=$("#password").type==="password"?"text":"password");
$("#logoutBtn").addEventListener("click",async()=>{if(DEMO_MODE){state.user=state.profile=null;showLogin()}else await firebase.signOut(firebase.auth)});
$("#adminBtn").addEventListener("click",()=>{showTab("adminTab");loadUsers()});
$$(".tab").forEach(b=>b.addEventListener("click",()=>{showTab(b.dataset.tab);if(b.dataset.tab==="adminTab")loadUsers()}));
$("#monthSelect").addEventListener("change",updatePeriodPreview);$("#yearSelect").addEventListener("change",updatePeriodPreview);$("#periodType").addEventListener("change",updatePeriodPreview);
$("#addActivityBtn").addEventListener("click",()=>{state.activities.push("");renderActivities();setTimeout(()=>$$(".activity-row textarea").at(-1)?.focus(),0)});
$("#evidenceInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value=""});
["dragenter","dragover"].forEach(ev=>$("#dropZone").addEventListener(ev,e=>{e.preventDefault();$("#dropZone").classList.add("drag")}));
["dragleave","drop"].forEach(ev=>$("#dropZone").addEventListener(ev,e=>{e.preventDefault();$("#dropZone").classList.remove("drag")}));
$("#dropZone").addEventListener("drop",e=>addFiles(e.dataTransfer.files));
$("#previewBtn").addEventListener("click",()=>{$("#reportPreview").innerHTML=previewHTML();$("#previewModal").classList.remove("hidden")});
$("#closePreview").addEventListener("click",()=>$("#previewModal").classList.add("hidden"));
$("#previewModal").addEventListener("click",e=>{if(e.target===$("#previewModal"))$("#previewModal").classList.add("hidden")});
$("#generateBtn").addEventListener("click",()=>generatePdf(true));
$("#refreshHistoryBtn").addEventListener("click",async()=>{await loadHistory();renderHistory();toast("Historial actualizado.")});
$("#userForm").addEventListener("submit",createUser);$("#settingsForm").addEventListener("submit",saveSettings);

fillPeriodControls(); renderActivities();
$("#demoHint").classList.toggle("hidden",!DEMO_MODE);
initFirebase().catch(err=>{console.error(err);toast("Error al inicializar Firebase: "+err.message)});

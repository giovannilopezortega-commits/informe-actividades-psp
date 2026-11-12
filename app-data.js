
function fillSignedPeriodControls(){
  if(!$("#signedMonthSelect")||!$("#signedYearSelect")) return;
  $("#signedMonthSelect").innerHTML=MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join("");
  const y=new Date().getFullYear();
  $("#signedYearSelect").innerHTML=[y-1,y,y+1].map(v=>`<option>${v}</option>`).join("");
  $("#signedMonthSelect").value=new Date().getMonth();
  $("#signedYearSelect").value=y;
}

function renderSignedSection(){
  if(!$("#signedTable")) return;
  if(DEMO_MODE){
    const key=state.profile ? `signedReports_${state.profile.uid}` : "signedReports";
    state.signedReports=JSON.parse(localStorage.getItem(key)||"[]");
  }
  if(state.profile){
    $("#signedUserName").textContent=state.profile.name||"—";
    $("#signedUserCode").textContent=state.profile.code||"—";
  }
  renderSignedFile();
  renderSignedReports();
}

function renderSignedFile(){
  if(!$("#signedFileCard")) return;
  const f=state.signedFile;
  $("#signedFileCard").classList.toggle("hidden",!f);
  if(f){
    $("#signedFileName").textContent=f.name;
    $("#signedFileSize").textContent=fileSize(f.size);
    $("#signedUploadStatus").className="signed-status ready";
    $("#signedUploadStatus").innerHTML="<strong>Listo para enviar</strong><span>Verifica mes y año antes de continuar.</span>";
  }else{
    $("#signedUploadStatus").className="signed-status pending";
    $("#signedUploadStatus").innerHTML="<strong>Pendiente de carga</strong><span>Selecciona el PDF firmado para continuar.</span>";
  }
}

function renderSignedReports(){
  if(!$("#signedTable")) return;
  const rows=state.signedReports||[];
  $("#signedEmpty").classList.toggle("hidden",rows.length>0);
  $("#signedTable").classList.toggle("hidden",rows.length===0);
  $("#signedTable tbody").innerHTML=rows.map(r=>`
    <tr>
      <td>${safe(r.period)}</td>
      <td>${r.driveUrl?`<a class="drive-link" href="${r.driveUrl}" target="_blank" rel="noopener" title="${safe(r.fileName)}">Abrir PDF</a>`:safe(r.fileName)}</td>
      <td>${new Date(r.createdAt).toLocaleString("es-MX")}</td>
      <td><span class="status-pill-ok">Enviado</span></td>
    </tr>`).join("");
}

async function fileToBase64(file){
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
    reader.onerror=()=>reject(reader.error||new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

async function uploadSignedReport(){
  try{
    if(!state.signedFile){
      toast("Selecciona primero el PDF firmado.");
      return;
    }
    if(state.signedFile.type!=="application/pdf"){
      toast("Solo se permiten archivos PDF.");
      return;
    }

    const maxMb=Number(window.APP_CONFIG.SIGNED_PDF_MAX_MB||15);
    if(state.signedFile.size>maxMb*1024*1024){
      toast(`El PDF no debe superar ${maxMb} MB.`);
      return;
    }

    const month=+$("#signedMonthSelect").value;
    const year=+$("#signedYearSelect").value;
    const period=`${MONTHS[month]} ${year}`;
    const endpoint=String(window.APP_CONFIG.DRIVE_WEB_APP_URL||"").trim();

    // Mientras no exista el Web App de Apps Script, conserva el modo de prueba local.
    if(!endpoint){
      const key=`signedReports_${state.profile.uid}`;
      const record={
        period,
        month:month+1,
        year:+year,
        fileName:state.signedFile.name,
        createdAt:new Date().toISOString(),
        status:"pending-drive"
      };
      state.signedReports.unshift(record);
      localStorage.setItem(key,JSON.stringify(state.signedReports));
      $("#signedUploadStatus").className="signed-status sent";
      $("#signedUploadStatus").innerHTML="<strong>Registrado en modo de prueba</strong><span>Falta activar la conexión con Google Drive.</span>";
      state.signedFile=null;
      $("#signedFileInput").value="";
      renderSignedFile();
      renderSignedReports();
      toast("Informe registrado. Falta activar Google Drive.");
      return;
    }

    $("#uploadSignedBtn").disabled=true;
    $("#signedUploadStatus").className="signed-status ready";
    $("#signedUploadStatus").innerHTML="<strong>Enviando a Google Drive…</strong><span>No cierres esta ventana.</span>";

    const base64=await fileToBase64(state.signedFile);
    const payload={
      action:"uploadSignedReport",
      rootFolderId:window.APP_CONFIG.DRIVE_ROOT_FOLDER_ID,
      userUid:state.profile.uid||state.user?.uid||"",
      name:state.profile.name,
      code:state.profile.code,
      contract:state.profile.contract||"",
      month:month+1,
      monthName:MONTHS[month],
      year:+year,
      originalFileName:state.signedFile.name,
      mimeType:"application/pdf",
      base64
    };

    const response=await fetch(endpoint,{
      method:"POST",
      body:JSON.stringify(payload)
    });

    const text=await response.text();
    let result;
    try{ result=JSON.parse(text); }catch{ throw new Error("Respuesta inválida del servidor de Drive."); }

    if(!result.ok){
      if(result.code==="DUPLICATE"){
        throw new Error("Ya existe un informe firmado para ese prestador, mes y año.");
      }
      throw new Error(result.error||"No se pudo guardar el informe en Google Drive.");
    }

    const record={
      period,
      month:month+1,
      year:+year,
      fileName:result.fileName||state.signedFile.name,
      createdAt:new Date().toISOString(),
      status:"sent",
      driveUrl:result.fileUrl||"",
      driveFileId:result.fileId||""
    };

    const key=`signedReports_${state.profile.uid}`;
    state.signedReports.unshift(record);
    localStorage.setItem(key,JSON.stringify(state.signedReports));

    state.signedFile=null;
    $("#signedFileInput").value="";
    renderSignedFile();
    renderSignedReports();
    $("#signedUploadStatus").className="signed-status sent";
    $("#signedUploadStatus").innerHTML="<strong>Informe enviado correctamente</strong><span>El PDF quedó archivado en Google Drive.</span>";
    toast("Informe firmado guardado en Google Drive.");
  }catch(err){
    console.error("Error al enviar informe firmado:",err);
    $("#signedUploadStatus").className="signed-status pending";
    $("#signedUploadStatus").innerHTML=`<strong>No se pudo enviar</strong><span>${safe(err?.message||"Error desconocido")}</span>`;
    toast(err?.message||"No se pudo enviar el informe.");
  }finally{
    $("#uploadSignedBtn").disabled=false;
  }
}

async function saveFirebaseReport(blob,fileName,activities){
  if(window.APP_CONFIG.REPORT_STORAGE_ENABLED!==true){
    await firebase.addDoc(firebase.collection(firebase.db,"reports"),{
      uid:state.user.uid,name:state.profile.name,code:state.profile.code,period:periodText(),
      month:+$("#monthSelect").value+1,year:+$("#yearSelect").value,activities,
      createdAt:firebase.serverTimestamp(),fileName,pdfUrl:null,evidences:[],downloadOnly:true
    });
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    await loadHistory();renderHistory();toast("PDF descargado e historial guardado. Conserva el archivo en tu equipo.");
    return;
  }
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
  const q=firebase.query(firebase.collection(firebase.db,"reports"),firebase.where("uid","==",state.user.uid));
  const snap=await firebase.getDocs(q);
  const time=r=>r.createdAt?.toMillis?r.createdAt.toMillis():new Date(r.createdAt||0).getTime();
  state.history=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>time(b)-time(a));
}
function renderHistory(){
  const rows=state.history;
  $("#historyEmpty").classList.toggle("hidden",rows.length>0);$("#historyTable").classList.toggle("hidden",rows.length===0);
  $("#historyTable tbody").innerHTML=rows.map(r=>{
    const d=r.createdAt?.toDate?r.createdAt.toDate():new Date(r.createdAt);
    const count=Array.isArray(r.activities)?r.activities.length:r.activities;
    return `<tr><td>${safe(r.period||"—")}</td><td>${isNaN(d)? "—":d.toLocaleString("es-MX")}</td><td>${count||0}</td><td>${r.pdfUrl?`<a href="${r.pdfUrl}" target="_blank">Abrir PDF</a>`:safe(r.fileName||"PDF descargado")+(r.downloadOnly?"<br><small>Descargado al equipo donde se generó</small>":"")}</td></tr>`
  }).join("");
}
function renderAdmin(){
  if(!state.profile||state.profile.role!=="admin")return;
  const s=state.settings;$("#sUnit").value=s.unit||"";$("#sStart").value=s.contractStart||"";$("#sEnd").value=s.contractEnd||"";$("#sGeneric").value=s.genericActivity||"";$("#sReviewer").value=s.reviewer||"";$("#sReviewerRole").value=s.reviewerRole||"";
  renderUsersTable();
  loadPositionCatalogForm();
  renderTestAccountCleanup();
}
async function loadUsers(){
  if(state.profile?.role!=="admin") return;
  if(DEMO_MODE)return;
  const snap=await firebase.getDocs(firebase.collection(firebase.db,"users"));state.users=snap.docs.map(d=>({...d.data(),uid:d.id}));renderUsersTable();
}
function renderUsersTable(){
  renderTestAccountCleanup();
  const showRetired=$("#showRetiredUsers")?.checked===true;
  const users=state.users.filter(u=>showRetired || u.retired!==true);
  $("#usersTable tbody").innerHTML=users.map(u=>{
    const protectedAccount=u.uid===state.user?.uid || u.uid===KEEP_ADMIN_UID;
    const disabled=DEMO_MODE || protectedAccount || userAccountActionPending;
    const button=(action,label)=>`<button type="button" class="btn secondary" data-user-action="${action}" data-user-uid="${safe(u.uid)}"${disabled?" disabled":""}>${label}</button>`;
    const actions=protectedAccount?'<span class="muted small">Cuenta protegida</span>':
      u.retired===true?button("restore","Restaurar"):
      button(u.active===true?"deactivate":"activate",u.active===true?"Desactivar":"Reactivar")+" "+button("delete","Eliminar");
    return `<tr><td>${safe(u.name)}</td><td>${safe(u.username)}</td><td>${safe(u.code)}</td><td>${safe(u.position||"Validador")}</td><td>${safe(u.contract)}</td><td>${safe(u.role)}</td><td>${u.retired===true?"Eliminada":u.active===true?"Activo":"Inactivo"}</td><td>${actions}</td></tr>`;
  }).join("");
}
async function createUser(e){
  e.preventDefault();
  const userData={name:$("#aName").value.trim(),username:$("#aUsername").value.trim().toLowerCase(),code:$("#aCode").value.trim(),contract:$("#aContract").value.trim(),position:$("#aPosition").value,role:$("#aRole").value,active:true};
  const pwd=$("#aPassword").value;
  if(DEMO_MODE){
    try{await createDemoUser(userData,pwd);renderUsersTable();e.target.reset();toast("Usuario de prueba guardado en este navegador.");}
    catch(err){toast(err.message||"No se pudo crear el usuario.");}
    return;
  }
  try{await createFirebaseUser(userData,pwd);await loadUsers();e.target.reset();toast("Usuario creado. Puede ingresar desde cualquier navegador.");}
  catch(err){toast(authErrorMessage(err));}
}
let pendingBulkUsers=[];

function splitCsvLine(line, delimiter){
  const out=[]; let cur=""; let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;} else quoted=!quoted;
    }else if(ch===delimiter && !quoted){out.push(cur.trim());cur="";}
    else cur+=ch;
  }
  out.push(cur.trim());
  return out;
}

function parseUsersCsv(text){
  const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2) throw new Error("El CSV no contiene registros.");
  const delimiter=(lines[0].split(";").length>lines[0].split(",").length)?";":",";
  const headers=splitCsvLine(lines[0],delimiter).map(h=>h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim());
  const required=["nombre","usuario","contrasena","codigo","contrato","puesto"];
  required.forEach(h=>{if(!headers.includes(h)) throw new Error("Falta la columna: "+h);});
  const rows=[]; const seen=new Set();
  for(let i=1;i<lines.length;i++){
    const vals=splitCsvLine(lines[i],delimiter); const obj={};
    headers.forEach((h,n)=>obj[h]=vals[n]||"");
    const u={
      name:(obj.nombre||"").trim(),
      username:(obj.usuario||"").trim().toLowerCase(),
      password:(obj.contrasena||"").trim(),
      code:(obj.codigo||"").trim(),
      contract:(obj.contrato||"").trim(),
      position:normalizePosition(obj.puesto),
      role:(obj.rol||"user").trim().toLowerCase()==="admin"?"admin":"user",
      active:true,row:i+1
    };
    if(!u.name||!u.username||!u.password||!u.code||!u.contract||!u.position) throw new Error("Fila "+u.row+": hay datos obligatorios vacíos.");
    if(u.password.length<6) throw new Error("Fila "+u.row+": la contraseña debe tener al menos 6 caracteres.");
    if(!POSITION_TYPES.includes(u.position)) throw new Error("Fila "+u.row+": puesto no válido. Usa SE, CAE, Técnico, Validador o Técnico de Voz y Datos.");
    if(seen.has(u.username)) throw new Error("Usuario duplicado en el CSV: "+u.username);
    seen.add(u.username); rows.push(u);
  }
  return rows;
}

function renderBulkPreview(){
  const box=$("#bulkUsersPreview"); if(!box) return;
  if(!pendingBulkUsers.length){box.classList.add("hidden");box.innerHTML="";$("#importUsersBtn").disabled=true;return;}
  const sample=pendingBulkUsers.slice(0,5);
  box.classList.remove("hidden");
  box.innerHTML="<strong>"+pendingBulkUsers.length+" usuarios listos para importar</strong>"+
    "<div class=\"table-wrap\"><table class=\"data-table compact-table\"><thead><tr><th>Nombre</th><th>Usuario</th><th>Código</th><th>Puesto</th><th>Rol</th></tr></thead><tbody>"+
    sample.map(u=>"<tr><td>"+safe(u.name)+"</td><td>"+safe(u.username)+"</td><td>"+safe(u.code)+"</td><td>"+safe(u.position)+"</td><td>"+safe(u.role)+"</td></tr>").join("")+
    "</tbody></table></div>"+(pendingBulkUsers.length>5?"<span class=\"muted small\">Vista previa de los primeros 5 registros.</span>":"");
  $("#importUsersBtn").disabled=false;
}

function downloadUsersTemplate(){
  const content="nombre,usuario,contraseña,codigo,contrato,puesto,rol\nKarla Villegas Arana,karla.villegas,Temporal2027,27C3082,PE-HE-000000,Validador,user";
  const blob=new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url;a.download="plantilla_prestadores.csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

async function importBulkUsers(){
  if(!pendingBulkUsers.length) return;
  const btn=$("#importUsersBtn"),status=$("#bulkUsersStatus");btn.disabled=true;
  let ok=0,failed=0; const errors=[];
  for(let i=0;i<pendingBulkUsers.length;i++){
    const u=pendingBulkUsers[i]; status.textContent="Importando "+(i+1)+" de "+pendingBulkUsers.length+"…";
    try{
      if(DEMO_MODE){
        const {password,row,...profile}=u;
        await createDemoUser(profile,password);
      }else{
        await createFirebaseUser({name:u.name,username:u.username,code:u.code,contract:u.contract,position:u.position,role:u.role,active:true},u.password);
      }
      ok++;
    }catch(err){failed++;errors.push(u.username+": "+(err?.message||"error"));try{if(!DEMO_MODE)await firebase.signOut(firebase.secondaryAuth);}catch{}}
    await new Promise(r=>setTimeout(r,120));
  }
  if(!DEMO_MODE) await loadUsers(); else renderUsersTable();
  pendingBulkUsers=[];$("#bulkUsersInput").value="";renderBulkPreview();
  status.textContent=failed?("Importación terminada: "+ok+" creados, "+failed+" con error. "+errors.slice(0,3).join(" | ")):("Importación terminada: "+ok+" usuarios creados correctamente.");
  toast(failed?("Se crearon "+ok+" usuarios; "+failed+" tuvieron error."):("Se crearon "+ok+" usuarios correctamente."));
}
function loadPositionCatalogForm(){
  if(!$("#catalogPositionSelect")) return;
  const pos=$("#catalogPositionSelect").value || "SE";
  const cfg=positionConfig(pos);
  $("#catalogGenericActivity").value=cfg.genericActivity||"";
  $("#catalogDevelopedActivities").value=(cfg.developedActivities||[]).join("\n");
}
async function savePositionCatalog(){
  const pos=$("#catalogPositionSelect").value;
  if(!state.settings.positions) state.settings.positions={};
  state.settings.positions[pos]={
    ...(DEMO_SETTINGS.positions[pos]?.catalogVersion ? {catalogVersion:DEMO_SETTINGS.positions[pos].catalogVersion} : {}),
    genericActivity:$("#catalogGenericActivity").value.trim(),
    developedActivities:$("#catalogDevelopedActivities").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  };
  if(!DEMO_MODE){
    await firebase.setDoc(firebase.doc(firebase.db,"config","institution"),{positions:state.settings.positions},{merge:true});
  }
  if(state.profile && currentPosition()===pos){
    $("#genericActivity").textContent=currentPositionConfig().genericActivity || "Pendiente de configurar para este puesto.";
    renderActivityCatalog();
  }
  toast("Catálogo de "+pos+" guardado.");
}
async function saveSettings(e){
  e.preventDefault(); const data={unit:$("#sUnit").value.trim(),contractStart:$("#sStart").value,contractEnd:$("#sEnd").value,genericActivity:$("#sGeneric").value.trim(),reviewer:$("#sReviewer").value.trim(),reviewerRole:$("#sReviewerRole").value.trim()};
  state.settings={...state.settings,...data};
  if(!DEMO_MODE)await firebase.setDoc(firebase.doc(firebase.db,"config","institution"),data,{merge:true});
  renderProfile();toast("Configuración guardada.");
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); const username=$("#username").value.trim().toLowerCase(),pwd=$("#password").value;
  try{
    if(DEMO_MODE){
      state.users=loadDemoUsers();
      if(demoUserStorageError) throw new Error(demoUserStorageError);
      const u=state.users.find(x=>x.username===username);
      if(!await verifyDemoPassword(u,pwd)) throw new Error("Usuario o contraseña incorrectos.");
      const {password,passwordHash,passwordSalt,passwordIterations,...profile}=u;
      state.user={uid:u.uid};state.profile=profile;state.history=JSON.parse(localStorage.getItem("demoHistory")||"[]");state.signedReports=JSON.parse(localStorage.getItem(`signedReports_${u.uid}`)||"[]");showApp();
    }else await firebase.signInWithEmailAndPassword(firebase.auth,usernameEmail(username),pwd);
  }catch(err){toast(authErrorMessage(err));}
});
$("#togglePassword").addEventListener("click",()=>$("#password").type=$("#password").type==="password"?"text":"password");
$("#logoutBtn").addEventListener("click",async()=>{if(DEMO_MODE){state.user=state.profile=null;showLogin()}else await firebase.signOut(firebase.auth)});
$("#adminBtn").addEventListener("click",()=>{showTab("adminTab");loadUsers()});
$$(".tab").forEach(b=>b.addEventListener("click",()=>{showTab(b.dataset.tab);if(b.dataset.tab==="adminTab")loadUsers()}));
$("#monthSelect").addEventListener("change",updatePeriodPreview);$("#yearSelect").addEventListener("change",updatePeriodPreview);$("#periodType").addEventListener("change",updatePeriodPreview);
$("#addActivityBtn").addEventListener("click",()=>{state.activities.push("");renderActivities();setTimeout(()=>$(".activity-row textarea").at(-1)?.focus(),0)});
$("#addCatalogActivityBtn")?.addEventListener("click",addCatalogActivity);
$("#evidenceInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value=""});
["dragenter","dragover"].forEach(ev=>$("#dropZone").addEventListener(ev,e=>{e.preventDefault();$("#dropZone").classList.add("drag")}));
["dragleave","drop"].forEach(ev=>$("#dropZone").addEventListener(ev,e=>{e.preventDefault();$("#dropZone").classList.remove("drag")}));
$("#dropZone").addEventListener("drop",e=>addFiles(e.dataTransfer.files));
$("#previewBtn").addEventListener("click",()=>{$("#reportPreview").innerHTML=previewHTML();$("#previewModal").classList.remove("hidden")});
$("#closePreview").addEventListener("click",()=>$("#previewModal").classList.add("hidden"));
$("#previewModal").addEventListener("click",e=>{if(e.target===$("#previewModal"))$("#previewModal").classList.add("hidden")});
$("#generateBtn").addEventListener("click",()=>generatePdf(true));
$("#refreshHistoryBtn").addEventListener("click",async()=>{await loadHistory();renderHistory();toast("Historial actualizado.")});
$("#signedFileInput").addEventListener("change",e=>{ const f=e.target.files?.[0]; if(!f) return; if(f.type!=="application/pdf"){toast("Solo se permiten archivos PDF."); e.target.value=""; return;} const maxMb=Number(window.APP_CONFIG.SIGNED_PDF_MAX_MB||15); if(f.size>maxMb*1024*1024){toast(`El PDF no debe superar ${maxMb} MB.`); e.target.value=""; return;} state.signedFile=f; renderSignedFile(); });
$("#removeSignedFileBtn").addEventListener("click",()=>{state.signedFile=null;$("#signedFileInput").value="";renderSignedFile();});
$("#uploadSignedBtn").addEventListener("click",uploadSignedReport);
$("#userForm").addEventListener("submit",createUser);$("#settingsForm").addEventListener("submit",saveSettings);
$("#downloadUsersTemplateBtn")?.addEventListener("click",downloadUsersTemplate);
$("#bulkUsersInput")?.addEventListener("change",async e=>{try{const f=e.target.files?.[0];if(!f)return;pendingBulkUsers=parseUsersCsv(await f.text());renderBulkPreview();$("#bulkUsersStatus").textContent="";}catch(err){pendingBulkUsers=[];renderBulkPreview();$("#bulkUsersStatus").textContent=err?.message||"No se pudo leer el CSV.";toast(err?.message||"No se pudo leer el CSV.");}});
$("#importUsersBtn")?.addEventListener("click",importBulkUsers);
$("#catalogPositionSelect")?.addEventListener("change",loadPositionCatalogForm);
$("#savePositionCatalogBtn")?.addEventListener("click",savePositionCatalog);

fillPeriodControls(); fillSignedPeriodControls(); renderActivities();
$("#demoHint").classList.toggle("hidden",!DEMO_MODE);
initFirebase().catch(err=>{console.error(err);toast("Error al inicializar Firebase: "+err.message)});





const TEST_ACCOUNT_USERNAMES = new Set(["esthela.torres","jesus.vallarin","rocio.enriquez","admin","lourdes.jimenez"]);
const KEEP_ADMIN_UID = "xaSvbf2IOrTDZ7FSAL4hLkmrKDF3";
function isKnownTestAccount(u){
  return !!u && u.uid!==KEEP_ADMIN_UID && u.uid!==state.user?.uid &&
    TEST_ACCOUNT_USERNAMES.has(String(u.username||"").trim().toLowerCase());
}
function renderTestAccountCleanup(){
  const button=$("#retireTestAccountsBtn");
  if(!button) return;
  const candidates=state.users.filter(u=>isKnownTestAccount(u)&&u.retired!==true);
  button.disabled=DEMO_MODE || state.user?.uid!==KEEP_ADMIN_UID || !candidates.length;
  button.textContent="Retirar cuentas de prueba"+(candidates.length?" ("+candidates.length+")":"");
}
async function retireTestAccounts(){
  if(DEMO_MODE || state.profile?.role!=="admin" || state.user?.uid!==KEEP_ADMIN_UID){
    toast("Ingresa con la cuenta giovanni para retirar las cuentas de prueba.");return;
  }
  const button=$("#retireTestAccountsBtn"), status=$("#testAccountCleanupStatus");
  button.disabled=true;
  try{
    await loadUsers();
    const candidates=state.users.filter(u=>isKnownTestAccount(u)&&u.retired!==true);
    if(!candidates.length){status.textContent="No quedan cuentas de prueba por retirar.";return;}
    if(!window.confirm("Se retirarán estas cuentas de prueba:\n"+
      candidates.map(u=>u.name+" ("+u.username+")").join("\n")+
      "\n\nConservarás giovanni. Las cuentas quedarán inactivas y ocultas en esta lista. Sus datos e informes se conservarán para poder recuperarlos. ¿Continuar?")) return;
    button.disabled=true;
    await firebase.runTransaction(firebase.db,async transaction=>{
      const keeper=await transaction.get(firebase.doc(firebase.db,"users",KEEP_ADMIN_UID));
      if(!keeper.exists() || keeper.data().active!==true || keeper.data().role!=="admin" ||
        keeper.data().username!=="giovanni") throw new Error("No se pudo verificar la cuenta giovanni.");
      const snapshots=[];
      for(const u of candidates) snapshots.push(await transaction.get(firebase.doc(firebase.db,"users",u.uid)));
      for(let i=0;i<snapshots.length;i++){
        const snapshot=snapshots[i];
        if(!snapshot.exists()) throw new Error("Cambió la lista de usuarios. Actualiza e intenta de nuevo.");
        const current={...snapshot.data(),uid:snapshot.id};
        if(!isKnownTestAccount(current) || current.username!==candidates[i].username)
          throw new Error("Cambió una cuenta. Actualiza e intenta de nuevo.");
      }
      for(let i=0;i<snapshots.length;i++) transaction.update(snapshots[i].ref,{
        active:false,retired:true,retiredAt:firebase.serverTimestamp(),
        retiredBy:state.user.uid,retiredReason:"Cuenta de prueba",
        activeBeforeRetirement:snapshots[i].data().active===true
      });
    });
    await loadUsers();
    status.textContent="Se retiraron "+candidates.length+" cuentas de prueba. La cuenta giovanni sigue activa. Los datos se conservaron.";
    toast("Cuentas de prueba retiradas.");
  }catch(err){status.textContent=authErrorMessage(err);toast(authErrorMessage(err));}
  finally{renderTestAccountCleanup();}
}
$("#retireTestAccountsBtn")?.addEventListener("click",retireTestAccounts);

let userAccountActionPending=false;
function userAccountChange(user,action){
  if(user.uid===state.user?.uid || user.uid===KEEP_ADMIN_UID)
    throw new Error("No puedes eliminar ni desactivar esta cuenta de administrador.");
  if(!["activate","deactivate","delete","restore"].includes(action))
    throw new Error("La acción no es válida.");
  if(user.retired===true && action!=="restore")
    throw new Error("Primero restaura la cuenta eliminada.");
  if(user.retired!==true && action==="restore")
    throw new Error("La cuenta ya está en la lista.");
  const audit={updatedAt:firebase.serverTimestamp(),updatedBy:state.user.uid};
  if(action==="delete")return {...audit,active:false,retired:true,
    retiredAt:firebase.serverTimestamp(),retiredBy:state.user.uid,
    retiredReason:"Eliminada desde Administración",activeBeforeRetirement:user.active===true};
  if(action==="restore")return {...audit,retired:false,active:false};
  return {...audit,active:action==="activate"};
}
async function manageUserAccount(uid,action){
  if(userAccountActionPending)return;
  const status=$("#userAccountStatus");
  try{
    if(DEMO_MODE)throw new Error("La administración de cuentas requiere el modo conectado.");
    if(state.profile?.role!=="admin" || !state.user?.uid)
      throw new Error("Solo el administrador puede administrar cuentas.");
    const user=state.users.find(u=>u.uid===uid);
    if(!user)throw new Error("No se encontró la cuenta. Actualiza la lista.");
    userAccountChange(user,action);
    const prompts={
      deactivate:"Desactivar esta cuenta impedirá su acceso. Sus datos e informes se conservarán.",
      activate:"La cuenta podrá volver a ingresar con su usuario y contraseña.",
      delete:"La cuenta quedará inactiva y se retirará de la lista. Sus datos e informes se conservarán. Podrás recuperarla con Mostrar cuentas eliminadas.",
      restore:"La cuenta volverá a la lista como inactiva. Después podrás reactivarla."
    };
    if(!window.confirm(user.name+" ("+user.username+")\n\n"+prompts[action]+"\n\n¿Continuar?"))return;
    userAccountActionPending=true;renderUsersTable();
    await firebase.runTransaction(firebase.db,async transaction=>{
      const ref=firebase.doc(firebase.db,"users",uid);
      const snapshot=await transaction.get(ref);
      if(!snapshot.exists())throw new Error("La cuenta ya no existe. Actualiza la lista.");
      const current={...snapshot.data(),uid:snapshot.id};
      if(current.username!==user.username || current.active!==user.active || current.retired!==user.retired)
        throw new Error("La cuenta cambió mientras la revisabas. Actualiza la lista e intenta de nuevo.");
      transaction.update(ref,userAccountChange(current,action));
    });
    const messages={deactivate:"Cuenta desactivada.",activate:"Cuenta reactivada.",delete:"Cuenta eliminada de la lista. Puedes restaurarla en Mostrar cuentas eliminadas.",restore:"Cuenta restaurada como inactiva. Pulsa Reactivar para permitir el acceso."};
    status.textContent=messages[action];toast(messages[action]);
  }catch(err){status.textContent=authErrorMessage(err);toast(authErrorMessage(err));}
  finally{
    userAccountActionPending=false;
    try{await loadUsers();}catch(err){status.textContent+=" No se pudo actualizar la lista: "+authErrorMessage(err);}
    renderUsersTable();
  }
}
$("#showRetiredUsers")?.addEventListener("change",renderUsersTable);
$("#usersTable")?.addEventListener("click",event=>{
  const button=event.target.closest("button[data-user-action]");
  if(button && !button.disabled)manageUserAccount(button.dataset.userUid,button.dataset.userAction);
});

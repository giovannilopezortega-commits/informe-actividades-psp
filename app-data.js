
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
  loadPositionCatalogForm();
}
async function loadUsers(){
  if(DEMO_MODE)return;
  const snap=await firebase.getDocs(firebase.collection(firebase.db,"users"));state.users=snap.docs.map(d=>({uid:d.id,...d.data()}));renderUsersTable();
}
function renderUsersTable(){
  $("#usersTable tbody").innerHTML=state.users.map(u=>`<tr><td>${safe(u.name)}</td><td>${safe(u.username)}</td><td>${safe(u.code)}</td><td>${safe(u.position||"Validador")}</td><td>${safe(u.contract)}</td><td>${safe(u.role)}</td><td>${u.active===false?"Inactivo":"Activo"}</td></tr>`).join("");
}
async function createUser(e){
  e.preventDefault();
  const userData={name:$("#aName").value.trim(),username:$("#aUsername").value.trim().toLowerCase(),code:$("#aCode").value.trim(),contract:$("#aContract").value.trim(),position:$("#aPosition").value,role:$("#aRole").value,active:true};
  const pwd=$("#aPassword").value;
  if(DEMO_MODE){state.users.push({uid:"demo-"+Date.now(),password:pwd,...userData});renderUsersTable();e.target.reset();toast("Usuario creado en modo demostración.");return;}
  const cred=await firebase.createUserWithEmailAndPassword(firebase.secondaryAuth,usernameEmail(userData.username),pwd);
  await firebase.setDoc(firebase.doc(firebase.db,"users",cred.user.uid),userData);await firebase.signOut(firebase.secondaryAuth);
  await loadUsers();e.target.reset();toast("Usuario creado.");
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
      position:(obj.puesto||"").trim(),
      role:(obj.rol||"user").trim().toLowerCase()==="admin"?"admin":"user",
      active:true,row:i+1
    };
    if(!u.name||!u.username||!u.password||!u.code||!u.contract||!u.position) throw new Error("Fila "+u.row+": hay datos obligatorios vacíos.");
    if(u.password.length<6) throw new Error("Fila "+u.row+": la contraseña debe tener al menos 6 caracteres.");
    if(!POSITION_TYPES.includes(u.position)) throw new Error("Fila "+u.row+": puesto no válido. Usa SE, CAE, Técnico o Validador.");
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
        if(state.users.some(x=>x.username===u.username)) throw new Error("usuario ya existente");
        state.users.push({uid:"demo-"+Date.now()+"-"+i,...u});
      }else{
        const cred=await firebase.createUserWithEmailAndPassword(firebase.secondaryAuth,usernameEmail(u.username),u.password);
        await firebase.setDoc(firebase.doc(firebase.db,"users",cred.user.uid),{name:u.name,username:u.username,code:u.code,contract:u.contract,position:u.position,role:u.role,active:true});
        await firebase.signOut(firebase.secondaryAuth);
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
      const u=state.users.find(x=>x.username===username&&x.password===pwd&&x.active!==false);if(!u)throw new Error("Usuario o contraseña incorrectos.");
      state.user={uid:u.uid};state.profile={...u};state.history=JSON.parse(localStorage.getItem("demoHistory")||"[]");state.signedReports=JSON.parse(localStorage.getItem(`signedReports_${u.uid}`)||"[]");showApp();
    }else await firebase.signInWithEmailAndPassword(firebase.auth,usernameEmail(username),pwd);
  }catch(err){toast(err.message||"No fue posible iniciar sesión.");}
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

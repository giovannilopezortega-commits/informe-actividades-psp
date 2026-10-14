const {readFileSync}=require('node:fs');
const {webcrypto}=require('node:crypto');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const storage=new Map();
function boot(){
 const nodes=new Map();
 function node(s){
  if(!nodes.has(s)){
   const classes=new Set();
   nodes.set(s,{value:'',innerHTML:'',textContent:'',handlers:{},addEventListener(event,fn){this.handlers[event]=fn;},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);}},reset(){this.wasReset=true;}});
  }
  return nodes.get(s);
 }
 const ctx={window:{APP_CONFIG:{DEMO_MODE:true}},document:{querySelector:node,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,TextEncoder,btoa,atob,console,setTimeout,clearTimeout};
 vm.createContext(ctx);
 vm.runInContext(readFileSync(__dirname+'/app-core.js','utf8'),ctx);
 vm.runInContext(readFileSync(__dirname+'/app-data.js','utf8'),ctx);
 vm.runInContext(`toast=message=>{window.lastMessage=message;};`,ctx);
 return {ctx,node,get:s=>vm.runInContext(s,ctx)};
}
async function main(){
 let app=boot();
 app.get(`state.profile={role:'admin'};`);
 for(const [s,value] of Object.entries({aName:'Persona de prueba',aUsername:' PRUEBA.NUEVA ',aPassword:'Clave de prueba 2026!',aCode:'001',aContract:'TEST',aPosition:'Técnico de Voz y Datos',aRole:'user'}))app.node('#'+s).value=value;
 await app.get(`createUser({preventDefault(){},target:$('#userForm')})`);
 assert.equal(app.get('state.users.length'),3);
 const saved=storage.get('informeDemoUsersV1');
 assert(!saved.includes('Clave de prueba 2026!'));
 assert(!Object.hasOwn(JSON.parse(saved).users[0],'password'));
 assert.equal(app.ctx.window.lastMessage,'Usuario de prueba guardado en este navegador.');
 // Un contexto nuevo simula cerrar y recargar la página.
 app=boot();
 assert.equal(app.get('state.users.length'),3);
 app.node('#username').value=' PRUEBA.NUEVA ';
 app.node('#password').value='Clave de prueba 2026!';
 await app.node('#loginForm').handlers.submit({preventDefault(){}});
 assert.equal(app.get('state.profile.username'),'prueba.nueva');
 assert.equal(app.get('state.profile.position'),'Técnico de Voz y Datos');
 assert.equal(app.get(`'passwordHash' in state.profile`),false);
 assert.equal(await app.get(`verifyDemoPassword(state.users.find(u=>u.username==='prueba.nueva'),'incorrecta')`),false);
 assert.equal(await app.get(`verifyDemoPassword(state.users.find(u=>u.username==='admin'),'admin123')`),true);
 assert.equal(await app.get(`verifyDemoPassword({...state.users[2],active:false},'Clave de prueba 2026!')`),false);
 app.get(`state.profile={role:'admin'};`);
 await assert.rejects(app.get(`createDemoUser({username:'PRUEBA.NUEVA'},'otraClave')`),/ya existe/);
 assert.equal(storage.get('informeDemoUsersV1'),saved);
 app.get(`pendingBulkUsers=[{name:'Importado',username:'importado',password:'Otra clave 2026!',code:'002',contract:'TEST',position:'Técnico',role:'user',active:true,row:2}];`);
 await app.get('importBulkUsers()');
 app=boot();
 assert.equal(app.get('state.users.length'),4);
 assert.equal(await app.get(`verifyDemoPassword(state.users.find(u=>u.username==='importado'),'Otra clave 2026!')`),true);
 app.get(`state.profile={role:'admin'};localStorage.setItem=()=>{throw Error('Sin espacio');};`);
 await assert.rejects(app.get(`createDemoUser({username:'no-guardado'},'clave123')`),/No se pudo guardar/);
 assert.equal(app.get(`state.users.some(u=>u.username==='no-guardado')`),false);
 storage.set('informeDemoUsersV1','datos dañados');
 app=boot();app.get(`state.profile={role:'admin'};`);
 await assert.rejects(app.get(`createDemoUser({username:'otro'},'clave123')`),/No se pudieron leer/);
 assert.equal(storage.get('informeDemoUsersV1'),'datos dañados');
 console.log('PASS: altas individuales y CSV sobreviven a recargar; login real, duplicados, contraseñas verificadas, almacenamiento fallido y datos dañados.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

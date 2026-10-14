const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const nodes=new Map();
const node=s=>{if(!nodes.has(s))nodes.set(s,{value:'',innerHTML:'',disabled:false,textContent:''});return nodes.get(s);};
const ctx={localStorage:{getItem:()=>null},window:{APP_CONFIG:{DEMO_MODE:true}},document:{querySelector:node,querySelectorAll:()=>[]},console};
vm.createContext(ctx);
vm.runInContext(readFileSync(__dirname+'/activity-catalogs.js','utf8'),ctx);
vm.runInContext(readFileSync(__dirname+'/app-core.js','utf8'),ctx);
vm.runInContext(`renderActivities=()=>{};toast=()=>{};`,ctx);
const get=code=>vm.runInContext(code,ctx);
for(const [position,count] of [['Técnico',38],['Validador',21],['Técnico de Voz y Datos',18]]){
  get(`state.profile={position:${JSON.stringify(position)}};state.settings.positions={};state.activities=[''];renderActivityCatalog();`);
  assert.equal((node('#activityCatalogSelect').innerHTML.match(/<option/g)||[]).length,count+1);
  assert.equal(node('#activityCatalogSelect').disabled,false);
  assert(get(`currentPositionConfig().genericActivity.length>100`));
  assert(get(`genericActivityTitle().includes(positionLabel())`));
  assert.equal(get(`new Set(currentPositionConfig().developedActivities).size`),count);
  node('#activityCatalogSelect').value='0';get('addCatalogActivity()');
  assert.equal(get(`state.activities[0]`),get(`currentPositionConfig().developedActivities[0]`));
  get(`state.settings.positions[${JSON.stringify(position)}]={genericActivity:'catálogo anterior',developedActivities:['actividad anterior']};`);
  assert.notEqual(get(`currentPositionConfig().genericActivity`),'catálogo anterior');
  get(`state.settings.positions[${JSON.stringify(position)}]={catalogVersion:1,genericActivity:'Personalizada',developedActivities:['Nueva actividad']};renderActivityCatalog();`);
  assert.equal(get(`currentPositionConfig().genericActivity`),'Personalizada');
  assert.equal(get(`currentPositionConfig().developedActivities[0]`),'Nueva actividad');
}
for(const p of ['SE','CAE'])assert.equal(get(`positionConfig('${p}').developedActivities.length`),18);
assert.equal(get(`normalizePosition('Tecnico/a de Voz y Datos')`),'Técnico de Voz y Datos');
assert.equal(get(`normalizePosition('Técnico en Capacitación Electoral')`),'Técnico');
assert.equal(get(`normalizePosition('Validador de Captura')`),'Validador');
const data=readFileSync(__dirname+'/app-data.js','utf8');
get(data.slice(data.indexOf('function splitCsvLine'),data.indexOf('function renderBulkPreview')));
const csv='nombre,usuario,contraseña,codigo,contrato,puesto,rol\nPrueba,prueba,clave123,001,TEST,Técnico de Voz y Datos,user';
assert.equal(get(`parseUsersCsv(${JSON.stringify(csv)})[0].position`),'Técnico de Voz y Datos');
get(data.slice(data.indexOf('async function savePositionCatalog(){'),data.indexOf('async function saveSettings')));
get(`state.settings.positions={};state.profile={position:'Técnico de Voz y Datos'};`);
node('#catalogPositionSelect').value='Técnico de Voz y Datos';
node('#catalogGenericActivity').value='Genérica personalizada';
node('#catalogDevelopedActivities').value='Actividad uno\nActividad dos';
get(`savePositionCatalog()`).then(()=>{
 assert.equal(get(`state.settings.positions['Técnico de Voz y Datos'].catalogVersion`),1);
 assert.equal(get(`currentPositionConfig().developedActivities.length`),2);
 assert.equal(get(`currentPositionConfig().genericActivity`),'Genérica personalizada');
 console.log('PASS: 38 actividades técnicas, 21 de validación, 18 de voz y datos; selección por perfil, CSV, actualización de catálogos anteriores y personalizaciones.');
}).catch(e=>{console.error(e);process.exitCode=1;});


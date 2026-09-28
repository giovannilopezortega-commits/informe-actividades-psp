async function generatePdf(save=true){
  const activities=state.activities.map(x=>x.trim()).filter(Boolean);
  if(!activities.length){toast("Agrega al menos una actividad.");return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const p=state.profile,s=state.settings;
  const x=14,w=182;
  doc.setFont("helvetica","bold"); doc.setFontSize(24); doc.text("INE",x,18);
  doc.setFontSize(8); doc.text("Instituto Nacional Electoral",x,23);
  doc.setFontSize(10); doc.text("Informe de Actividades",195,16,{align:"right"}); doc.text("Prestadores de Servicios Profesionales",195,21,{align:"right"});
  let y=30;
  const box=(bx,by,bw,bh)=>doc.rect(bx,by,bw,bh);
  box(x,y,w,31); doc.setFontSize(7); doc.text("Nombre del Prestador del Servicio",x+2,y+5); doc.text("Unidad Administrativa",x+65,y+5); doc.text("Código",x+130,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.text(p.name,x+32,y+18,{align:"center",maxWidth:58}); doc.text(s.unit,x+96,y+14,{align:"center",maxWidth:60}); doc.text(p.code,x+155,y+18,{align:"center"});
  doc.line(x+62,y,x+62,y+31); doc.line(x+127,y,x+127,y+31);
  y+=31; box(x,y,w,13); doc.setFont("helvetica","bold");doc.text("Contrato No:",x+2,y+5);doc.setFont("helvetica","normal");doc.text(p.contract,x+w/2,y+10,{align:"center"});
  y+=13; box(x,y,w,29); doc.setFont("helvetica","bold"); doc.text("Vigencia del Contrato",x+w/2,y+6,{align:"center"}); doc.setFont("helvetica","normal");
  doc.text(`Del: ${formatDate(s.contractStart)}   Al: ${formatDate(s.contractEnd)}`,x+w/2,y+12,{align:"center"}); doc.setFont("helvetica","bold");doc.text(periodText(),x+w/2,y+22,{align:"center",maxWidth:w-8});
  y+=32; doc.setFontSize(8);doc.text("Actividad Genérica del Validador de Captura",x+w/2,y,{align:"center"});y+=2;
  const genericLines=doc.splitTextToSize(s.genericActivity,w-8); const gh=Math.max(19,genericLines.length*4+7); box(x,y,w,gh); doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.text(genericLines,x+4,y+6);
  y+=gh+5;doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("Actividades Desarrolladas en el Periodo",x+w/2,y,{align:"center"});y+=2;
  let actLines=[];activities.forEach(a=>{ const lines=doc.splitTextToSize("• "+a,w-12);actLines.push(...lines,""); });
  const ah=Math.max(67,actLines.length*4+8); box(x,y,w,ah);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text(actLines,x+6,y+7);
  y+=ah+6;doc.setFont("helvetica","bold");doc.text("Elaboró",x+33,y);doc.text("Revisó por parte del INE",x+139,y,{align:"center"});
  y+=25;doc.setFontSize(8);doc.text(p.name,x+33,y,{align:"center",maxWidth:70});doc.text(s.reviewer,x+139,y,{align:"center",maxWidth:80});
  y+=5;doc.setFont("helvetica","normal");doc.text("El Prestador del Servicio",x+33,y,{align:"center"});doc.text(s.reviewerRole,x+139,y,{align:"center"});

  // Convertir la primera página de jsPDF a PDFLib para poder anexar PDFs e imágenes.
  const baseBytes=doc.output("arraybuffer");
  const finalPdf=await PDFLib.PDFDocument.load(baseBytes);
  for(let i=0;i<state.evidenceFiles.length;i++){
    const f=state.evidenceFiles[i], buf=await f.arrayBuffer();
    if(f.type==="application/pdf"){
      const incoming=await PDFLib.PDFDocument.load(buf);
      const pages=await finalPdf.copyPages(incoming,incoming.getPageIndices());
      pages.forEach(pg=>finalPdf.addPage(pg));
    }else{
      const page=finalPdf.addPage([595.28,841.89]);
      const img=f.type==="image/png"?await finalPdf.embedPng(buf):await finalPdf.embedJpg(buf);
      const maxW=515,maxH=730,scale=Math.min(maxW/img.width,maxH/img.height,1);
      const iw=img.width*scale,ih=img.height*scale;
      page.drawText(`Anexo ${i+1}. Evidencia fotográfica`,{x:40,y:800,size:11});
      page.drawImage(img,{x:(595.28-iw)/2,y:(760-ih)/2+30,width:iw,height:ih});
    }
  }
  const bytes=await finalPdf.save();
  const fileName=`Informe_${slug(p.name)}_${MONTHS[+$("#monthSelect").value]}_${$("#yearSelect").value}.pdf`;
  const blob=new Blob([bytes],{type:"application/pdf"});
  if(save){
    if(DEMO_MODE){
      const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
      const record={period:periodText(),createdAt:new Date().toISOString(),activities:activities.length,fileName,url:null};
      state.history.unshift(record); localStorage.setItem("demoHistory",JSON.stringify(state.history)); renderHistory(); toast("PDF generado correctamente.");
    }else{
      await saveFirebaseReport(blob,fileName,activities);
    }
  }else{
    const url=URL.createObjectURL(blob); window.open(url,"_blank"); setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
function slug(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_|_$/g,"");}


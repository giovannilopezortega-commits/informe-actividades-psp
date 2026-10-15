let reportLogoBytesPromise;
function loadReportLogo(){
  if(!reportLogoBytesPromise){
    reportLogoBytesPromise=fetch("assets/logo-ine-gris.png").then(response=>{
      if(!response.ok) throw new Error("No se pudo cargar el logo del informe. Recarga la página.");
      return response.arrayBuffer();
    }).then(bytes=>new Uint8Array(bytes)).catch(error=>{reportLogoBytesPromise=null;throw error;});
  }
  return reportLogoBytesPromise;
}

async function generatePdf(save=true){
  try{
    const activities=state.activities.map(x=>x.trim()).filter(Boolean);
    if(!activities.length){
      toast("Agrega al menos una actividad antes de generar el PDF.");
      return;
    }
    if(!window.jspdf || !window.jspdf.jsPDF){
      throw new Error("No se pudo cargar el generador de PDF. Recarga la página e inténtalo de nuevo.");
    }

    toast("Generando PDF...");
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:"mm",format:"a4"});
    const p=state.profile,s=state.settings;
    const x=14,w=182;

    doc.setFont("helvetica","bold");
    const logoBytes=await loadReportLogo();
    const logo=doc.getImageProperties(logoBytes);
    doc.addImage(logoBytes,"PNG",14,7,52,52*logo.height/logo.width);

    doc.setFontSize(10);
    doc.text("Informe de Actividades",195,14,{align:"right"});
    doc.text("Prestadores de Servicios Profesionales",195,19,{align:"right"});
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.text(`Fecha de elaboración: ${elaborationDateText()}`,195,24,{align:"right"});

    let y=30;
    const box=(bx,by,bw,bh)=>doc.rect(bx,by,bw,bh);

    box(x,y,w,31);
    doc.setFontSize(7);
    doc.text("Nombre del Prestador del Servicio",x+31,y+5,{align:"center"});
    doc.text("Unidad Administrativa",x+94.5,y+5,{align:"center"});
    doc.text("Código",x+154.5,y+5,{align:"center"});

    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.text(String(p.name||""),x+31,y+18,{align:"center",maxWidth:58});
    doc.text(String(s.unit||""),x+94.5,y+14,{align:"center",maxWidth:60});
    doc.text(String(p.code||""),x+154.5,y+18,{align:"center"});
    doc.line(x+62,y,x+62,y+31);
    doc.line(x+127,y,x+127,y+31);

    y+=31;
    box(x,y,w,13);
    doc.setFont("helvetica","bold");
    doc.text("Contrato No:",x+2,y+5);
    doc.setFont("helvetica","normal");
    doc.text(String(p.contract||""),x+w/2,y+10,{align:"center",maxWidth:w-10});

    y+=13;
    box(x,y,w,29);
    doc.setFont("helvetica","bold");
    doc.text("Vigencia del Contrato",x+w/2,y+6,{align:"center"});
    doc.setFont("helvetica","normal");
    doc.text(`Del: ${formatDate(s.contractStart)}   Al: ${formatDate(s.contractEnd)}`,x+w/2,y+12,{align:"center"});
    doc.setFont("helvetica","bold");
    doc.text(periodText(),x+w/2,y+22,{align:"center",maxWidth:w-8});

    y+=32;
    doc.setFontSize(8);
    doc.text(genericActivityTitle().toLocaleUpperCase("es-MX"),x+w/2,y,{align:"center"});
    y+=2;
    const genericLines=doc.splitTextToSize(String(currentPositionConfig().genericActivity||"Pendiente de configurar para este puesto."),w-8);
    const gh=Math.max(19,genericLines.length*4+7);
    box(x,y,w,gh);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.text(genericLines,x+4,y+6);

    y+=gh;
    const footerY=253,signHeight=20,legalHeight=14,titleHeight=5;
    const legalText='"Este documento ha sido firmado electrónicamente de conformidad con el artículo 22 del Reglamento para el uso y operación de la Firma Electrónica Avanzada en el Instituto Nacional Electoral".';
    const drawFooter=()=>{
      box(x,footerY,w,signHeight);
      doc.line(x+w/2,footerY,x+w/2,footerY+signHeight);
      doc.setFont("helvetica","normal");doc.setFontSize(8);
      doc.text("Elaboró",x+w/4,footerY+3.5,{align:"center"});
      doc.text("Revisó por parte del INE",x+3*w/4,footerY+3.5,{align:"center"});
      const writeName=(name,cx)=>{
        let size=8,lines;
        do{doc.setFontSize(size);lines=doc.splitTextToSize(String(name||""),w/2-10);size-=0.5;}while(lines.length>3 && size>=6);
        doc.text(lines,cx,footerY+11,{align:"center",lineHeightFactor:1.15});
      };
      writeName(p.name,x+w/4);writeName(s.reviewer,x+3*w/4);
      box(x,footerY+signHeight,w,legalHeight);
      doc.setFont("helvetica","italic");doc.setFontSize(7);
      const legalLines=doc.splitTextToSize(legalText,w-8);
      doc.text(legalLines,x+w/2,footerY+signHeight+5,{align:"center",lineHeightFactor:1.2});
    };
    doc.setFont("helvetica","normal");doc.setFontSize(8);
    const actLines=[];
    activities.forEach((a,n)=>{
      actLines.push(...doc.splitTextToSize(`${n+1}. ${a}`,w-12),"");
    });
    if(y+titleHeight+12>footerY){doc.addPage();y=30;}
    while(actLines.length){
      doc.setFont("helvetica","bold");doc.setFontSize(8);
      box(x,y,w,titleHeight);
      doc.text("ACTIVIDADES DESARROLLADAS EN EL PERIODO",x+w/2,y+3.5,{align:"center"});
      y+=titleHeight;
      const capacity=Math.max(1,Math.floor((footerY-y-8)/4));
      const pageLines=actLines.splice(0,capacity);
      box(x,y,w,footerY-y);
      doc.setFont("helvetica","normal");doc.setFontSize(8);
      doc.text(pageLines,x+6,y+6,{lineHeightFactor:4/(8*25.4/72)});
      drawFooter();
      if(actLines.length){doc.addPage();y=30;}
    }

    const fileName=`Informe_${slug(p.name)}_${MONTHS[+$("#monthSelect").value]}_${$("#yearSelect").value}.pdf`;

    // Si no hay anexos, descargar directamente con jsPDF.
    if(state.evidenceFiles.length===0){
      if(save){
        if(!DEMO_MODE){await saveFirebaseReport(doc.output("blob"),fileName,activities);return;}
        doc.save(fileName);
        const record={period:periodText(),createdAt:new Date().toISOString(),activities:activities.length,fileName,url:null};
        if(DEMO_MODE){
          state.history.unshift(record);
          localStorage.setItem("demoHistory",JSON.stringify(state.history));
          renderHistory();
        }
        toast("PDF generado correctamente.");
      }else{
        const blob=doc.output("blob");
        const url=URL.createObjectURL(blob);
        window.open(url,"_blank");
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      }
      return;
    }

    if(!window.PDFLib || !window.PDFLib.PDFDocument){
      throw new Error("No se pudo cargar el módulo de anexos PDF.");
    }

    const baseBytes=doc.output("arraybuffer");
    const finalPdf=await PDFLib.PDFDocument.load(baseBytes);

    for(let i=0;i<state.evidenceFiles.length;i++){
      const f=state.evidenceFiles[i];
      const buf=await f.arrayBuffer();

      if(f.type==="application/pdf"){
        const incoming=await PDFLib.PDFDocument.load(buf);
        const pages=await finalPdf.copyPages(incoming,incoming.getPageIndices());
        pages.forEach(pg=>finalPdf.addPage(pg));
      }else{
        const page=finalPdf.addPage([595.28,841.89]);
        const img=f.type==="image/png"
          ? await finalPdf.embedPng(buf)
          : await finalPdf.embedJpg(buf);

        const maxW=515,maxH=730;
        const scale=Math.min(maxW/img.width,maxH/img.height,1);
        const iw=img.width*scale,ih=img.height*scale;
        page.drawText(`Anexo ${i+1}. Evidencia fotográfica`,{x:40,y:800,size:11});
        page.drawImage(img,{x:(595.28-iw)/2,y:(760-ih)/2+30,width:iw,height:ih});
      }
    }

    const bytes=await finalPdf.save();
    const blob=new Blob([bytes],{type:"application/pdf"});

    if(save){
      if(DEMO_MODE){
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;
        a.download=fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),5000);

        const record={period:periodText(),createdAt:new Date().toISOString(),activities:activities.length,fileName,url:null};
        state.history.unshift(record);
        localStorage.setItem("demoHistory",JSON.stringify(state.history));
        renderHistory();
        toast("PDF generado correctamente.");
      }else{
        await saveFirebaseReport(blob,fileName,activities);
      }
    }else{
      const url=URL.createObjectURL(blob);
      window.open(url,"_blank");
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
  }catch(err){
    console.error("Error al generar PDF:",err);
    toast("No se pudo generar el PDF: "+(err?.message||"error desconocido"));
  }
}

function slug(s){
  return String(s||"informe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"_")
    .replace(/^_|_$/g,"");
}


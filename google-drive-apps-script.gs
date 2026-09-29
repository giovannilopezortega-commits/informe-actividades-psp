/**
 * BACKEND DE GOOGLE DRIVE PARA INFORMES FIRMADOS
 * Proyecto: Informe de Actividades PSP
 *
 * PASOS:
 * 1. Crear un proyecto nuevo en https://script.google.com/
 * 2. Pegar este archivo en Code.gs.
 * 3. Implementar > Nueva implementación > Aplicación web.
 * 4. Ejecutar como: "Yo".
 * 5. Quién tiene acceso: "Cualquier persona" o la opción disponible que permita llamadas desde GitHub Pages.
 * 6. Copiar la URL /exec en DRIVE_WEB_APP_URL de firebase-config.js.
 *
 * Carpeta raíz actual:
 * INFORMES FIRMADOS PSP
 * ID: 1r97hwRuop6TfxJ_XIG4l5CRn4arPSNBj
 */

const DEFAULT_ROOT_FOLDER_ID = "1r97hwRuop6TfxJ_XIG4l5CRn4arPSNBj";

function doGet() {
  return json_({ok:true, service:"Informes firmados PSP", status:"ready"});
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ok:false, error:"Solicitud vacía."});
    }

    const data = JSON.parse(e.postData.contents);

    if (data.action !== "uploadSignedReport") {
      return json_({ok:false, error:"Acción no válida."});
    }

    validate_(data);

    const rootId = data.rootFolderId || DEFAULT_ROOT_FOLDER_ID;
    const root = DriveApp.getFolderById(rootId);

    const yearFolder = getOrCreateFolder_(root, String(data.year));
    const monthFolder = getOrCreateFolder_(yearFolder, pad2_(data.month) + " - " + cleanName_(data.monthName));
    const personFolderName = cleanName_(data.code) + " - " + cleanName_(data.name);
    const personFolder = getOrCreateFolder_(monthFolder, personFolderName);

    const finalName =
      "Informe_Firmado_" +
      cleanFile_(data.name) + "_" +
      cleanFile_(data.code) + "_" +
      pad2_(data.month) + "_" +
      data.year + ".pdf";

    const existing = personFolder.getFilesByName(finalName);
    if (existing.hasNext()) {
      return json_({
        ok:false,
        code:"DUPLICATE",
        error:"Ya existe un informe firmado para este prestador y periodo."
      });
    }

    const bytes = Utilities.base64Decode(data.base64);
    const blob = Utilities.newBlob(bytes, "application/pdf", finalName);
    const file = personFolder.createFile(blob);

    // Guardar metadatos descriptivos en Drive.
    file.setDescription(
      "Prestador: " + data.name + "\n" +
      "Código: " + data.code + "\n" +
      "Contrato: " + (data.contract || "") + "\n" +
      "Periodo: " + data.monthName + " " + data.year + "\n" +
      "Cargado desde la app de Informes PSP."
    );

    return json_({
      ok:true,
      fileId:file.getId(),
      fileName:file.getName(),
      fileUrl:file.getUrl(),
      folderId:personFolder.getId(),
      folderUrl:"https://drive.google.com/drive/folders/" + personFolder.getId()
    });

  } catch (err) {
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function validate_(d) {
  const required = ["name","code","month","monthName","year","base64"];
  required.forEach(function(k){
    if (d[k] === undefined || d[k] === null || String(d[k]).trim() === "") {
      throw new Error("Falta el dato requerido: " + k);
    }
  });

  const month = Number(d.month);
  const year = Number(d.year);
  if (month < 1 || month > 12) throw new Error("Mes no válido.");
  if (year < 2026 || year > 2035) throw new Error("Año no válido.");

  // Validación simple de encabezado PDF: base64 de "%PDF" suele comenzar por JVBER.
  if (String(d.base64).substring(0,5) !== "JVBER") {
    throw new Error("El archivo recibido no parece ser un PDF válido.");
  }
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function cleanName_(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFile_(value) {
  return cleanName_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pad2_(n) {
  return ("0" + Number(n)).slice(-2);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

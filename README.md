# Informe de Actividades PSP — GitHub Pages + Firebase

Aplicación web para generar el Informe de Actividades de Prestadores de Servicios Profesionales, anexar evidencias y producir un único PDF final.

## Funciones incluidas

- Inicio de sesión con usuario y contraseña.
- Datos del prestador precargados: nombre, código, contrato y “Elaboró”.
- Unidad Administrativa, vigencia, actividad genérica y revisor configurables.
- Selector de mes, año y tipo de periodo.
- Captura dinámica de actividades.
- Carga de JPG, PNG y PDF.
- Generación de un único PDF: informe + anexos.
- Historial de informes.
- Panel de administración para alta de usuarios y configuración institucional.
- Diseño responsivo para PC y celular.
- PWA básica instalable.

## Prueba inmediata

La app viene inicialmente con `DEMO_MODE = true` en `firebase-config.js`.

Usuarios de prueba:

- Prestador: `karla` / `123456`
- Administrador: `admin` / `admin123`

En modo demostración el historial se guarda únicamente en el navegador. Los archivos no se suben a la nube.

## Pasar a producción con Firebase

1. En Firebase Console crea un proyecto.
2. En **Authentication > Sign-in method** activa **Email/Password**.
3. Crea una base **Cloud Firestore**.
4. Activa **Storage**.
5. Crea una **Web App** en el proyecto y copia su configuración.
6. Abre `firebase-config.js`, pega esos valores y cambia:

```js
export const DEMO_MODE = false;
```

7. Publica las reglas de `firestore.rules` y `storage.rules`.
8. Crea manualmente el primer administrador en Firebase Authentication usando un correo interno con esta forma:

`admin@informes.local`

9. Copia el UID del administrador y crea en Firestore:

Colección: `users`  
Documento: `<UID del usuario>`

Campos:

```json
{
  "username": "admin",
  "name": "Administrador",
  "code": "ADMIN",
  "contract": "—",
  "role": "admin",
  "active": true
}
```

10. Crea el documento `config/institution` con la configuración institucional. También puedes hacerlo desde el panel del administrador una vez que inicies sesión.

## Publicar en GitHub Pages

1. Crea un repositorio, por ejemplo `informe-prestadores`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En GitHub entra a **Settings > Pages**.
4. En **Build and deployment** elige `Deploy from a branch`.
5. Selecciona `main` y `/root`.
6. Guarda. GitHub mostrará la URL pública.

## Importante sobre usuarios

El usuario visible puede ser `karla`, `juan.perez`, etc. Internamente Firebase usa:

`usuario@informes.local`

La app hace esa conversión automáticamente. El prestador nunca necesita escribir el correo interno.

## Estructura de almacenamiento

PDF final:

`reports/<uid>/<año>/<mes>/<timestamp>_Informe_....pdf`

Evidencias:

`evidence/<uid>/<timestamp>/...`

## Pendiente para igualar al 100% el formato oficial

El PDF ya replica la estructura principal del formato mostrado. Para dejarlo idéntico en tipografía, tamaños, logotipo, márgenes y distribución, conviene sustituir la plantilla visual usando el PDF/Word original del formato institucional.

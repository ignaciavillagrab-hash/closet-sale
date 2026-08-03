// Configuración del sitio — Closet & Libros Sale
window.SITE_CONFIG = {
  // Pega aquí la URL de "Publicar en la web" de tu Google Sheet (formato CSV).
  // Debe apuntar a la hoja "Inventario y Ventas" en formato CSV.
  // Ejemplo: https://docs.google.com/spreadsheets/d/e/2PACX-XXXXXXX/pub?gid=0&single=true&output=csv
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNWirDhxQIM5kblmGVOdx0MLCGhglqhF-V_a2RE-_BCCjDAFHoGOyfR8E8vjmO3A/pub?gid=120620776&single=true&output=csv",

  WHATSAPP_NUMBER: "56981365719",

  // Sube este número cada vez que reemplaces fotos, para forzar que el navegador
  // descargue la versión nueva en vez de usar la copia guardada en caché.
  IMG_VERSION: 4,

  // Sube este número cada vez que edites catalog.json (orden de fotos, precios, etc.)
  // para forzar que el navegador descargue la versión nueva del catálogo.
  DATA_VERSION: 4,

  BANK_INFO: {
    nombre: "Maria Villagra",
    rut: "19.323.461-5",
    banco: "Banco de Chile",
    tipoCuenta: "Cuenta Corriente",
    numeroCuenta: "00-823-03786-10",
    email: "ignaciavillagrab@gmail.com"
  }
};

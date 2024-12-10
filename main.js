const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
async function extractFormFields(pdfPath1, pdfPath2) {
  const pdfDocs = [pdfPath1, pdfPath2].map(async (path) => {
    const fileBytes = fs.readFileSync(path);
    return await PDFDocument.load(fileBytes);
  });
  const [pdfDoc1, pdfDoc2] = await Promise.all(pdfDocs);
  const form1 = pdfDoc1.getForm();
  const form2 = pdfDoc2.getForm();
  const fields1 = form1.getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name, // Obtiene el tipo de campo
  }));
  const fields2 = form2.getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name, // Obtiene el tipo de campo
  }));
  // Filtra los campos únicos de cada formulario basándose en el nombre
  const uniqueFields1 = fields1.filter(
    (f1) => !fields2.some((f2) => f1.name === f2.name)
  );
  const uniqueFields2 = fields2.filter(
    (f2) => !fields1.some((f1) => f1.name === f2.name)
  );
  const formatFields = (fields) =>
    fields.map((f) => `${f.name} (${f.type})`).join("\n");
  const uniqueFieldsText =
    `Campos únicos en ${pdfPath1}:\n${formatFields(uniqueFields1)}\n\n` +
    `Campos únicos en ${pdfPath2}:\n${formatFields(uniqueFields2)}\n`;
  fs.writeFileSync("uniqueFieldsI131.txt", uniqueFieldsText);
  console.log("Los campos únicos han sido guardados en uniqueFields.txt!");
}
// Asegúrate de reemplazar 'path/to/your/first-form.pdf' y 'path/to/your/second-form.pdf' con las rutas correctas a los archivos PDF
extractFormFields("old-t-visa.pdf", "new-t-visa.pdf");

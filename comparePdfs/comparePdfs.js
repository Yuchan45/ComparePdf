import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function extractFormFields(pdfPath1, pdfPath2, resultLogPath) {
  try {
    const pdfDocs = [pdfPath1, pdfPath2].map(async (path) => {
      const fileBytes = fs.readFileSync(path);
      return await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    });
    const [pdfDoc1, pdfDoc2] = await Promise.all(pdfDocs);
    const form1 = pdfDoc1.getForm();
    const form2 = pdfDoc2.getForm();
    const fields1 = form1.getFields().map((field) => ({
      name: field.getName(),
      type: field.constructor.name, // Obtiene el tipo de campo
    }));
    console.log(`Cantidad de fields del '${pdfPath1}': ${fields1.length}`);

    const fields2 = form2.getFields().map((field) => ({
      name: field.getName(),
      type: field.constructor.name, // Obtiene el tipo de campo
    }));
    console.log(`Cantidad de fields del '${pdfPath2}': ${fields2.length}`);

    // Filtra los campos únicos de cada formulario basándose en el nombre
    const uniqueFields1 = fields1.filter(
      (f1) => !fields2.some((f2) => f1.name === f2.name)
    );
    const uniqueFields2 = fields2.filter(
      (f2) => !fields1.some((f1) => f1.name === f2.name)
    );

    // Campos compartidos/comunes entre ambos pdfs
    const commonFields = fields1.filter((f1) =>
      fields2.some((f2) => f1.name === f2.name)
    );

    const formatFields = (fields) =>
      fields.map((f) => `${f.name} (${f.type})`).join('\n');

    const uniqueFieldsText =
      `Campos únicos en ${pdfPath1}:\n${formatFields(uniqueFields1)}\n\n` +
      `Campos únicos en ${pdfPath2}:\n${formatFields(uniqueFields2)}\n\n` +
      `Campos compartidos en ambos pdfs:\n${formatFields(commonFields)}\n`;

    if (!fs.existsSync(resultLogPath)) {
      fs.mkdirSync(resultLogPath, { recursive: true });
    }
    // Luego, puedes proceder a escribir el archivo
    fs.writeFileSync(
      path.join(resultLogPath, 'uniqueFieldsI485.txt'),
      uniqueFieldsText
    );
    console.log('Los campos únicos han sido guardados en uniqueFields.txt!');

    return true;
  } catch (err) {
    throw Error(`Error in extractFormFields: ${err}`);
  }
}

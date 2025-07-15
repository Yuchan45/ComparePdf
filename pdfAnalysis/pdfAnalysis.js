import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

/**
 * Genera un reporte de los campos de formulario de un PDF,
 * La validacion de duplicados es al pedo porque Adobe NO permite duplciados, les agrega un #0, #1 al final para evitarlos.
 * Lo que si, indica si un campo tiene la propiedad 'Allow Rich Text' activada. Funciona, testeado.
 */
export async function generateReport(pdfPath, resultLogPath, filename) {
  try {
    const fileBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(fileBytes, {
      ignoreEncryption: true,
    });

    const form = pdfDoc.getForm();
    const seen = new Set();
    const duplicates = new Set();
    let invalidTypeFields = [];
    let textFieldsCount = 0;
    let checkboxesCount = 0;

    const fields = form.getFields().map((field) => {
      const name = field.getName();

      // Duplicados
      if (seen.has(name)) {
        duplicates.add(name);
      } else {
        seen.add(name);
      }

      // Deteccion de Allow Rich Text and count
      let allowRichText = false;
      if (field instanceof PDFTextField) {
        allowRichText = field.isRichFormatted();
        textFieldsCount++;
      } else if (field instanceof PDFCheckBox) {
        checkboxesCount++;
      } else {
        const message = `Field '${name}' de tipo invalido: ${field.constructor.name}`;
        invalidTypeFields.push(message);
        console.error(message);
      }

      return {
        name,
        type: field.constructor.name,
        allowRichText, // boolean
      };
    });

    // txt de salida
    const totalFields = `Cantidad de fields: ${fields.length}\n`;
    const partialCounts = `Cantidad de PDFTextField: ${textFieldsCount}\nCantidad de PDFCheckBox:${checkboxesCount}\n`;
    const sumatoria = `Suma Total PDFTextField + PDFCheckBox = ${
      textFieldsCount + checkboxesCount
    }\n\n\n\n`;
    const header = totalFields + partialCounts + sumatoria;

    const listTxt = fields
      .map(
        (f) =>
          `${f.name} (${f.type}) — Allow Rich Text: ${
            f.allowRichText ? 'YES' : 'NO'
          }`
      )
      .join('\n');
    const dupTxt =
      duplicates.size > 0
        ? `\n\nCampos duplicados encontrados:\n${[...duplicates].join(', ')}\n`
        : '';

    const invalidTypeFieldsTxt =
      '\n\n\nFields de tipo invalido: \n' + invalidTypeFields.join('\n');

    const output = header + listTxt + dupTxt + invalidTypeFieldsTxt;

    if (!fs.existsSync(resultLogPath)) {
      fs.mkdirSync(resultLogPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(resultLogPath, `results-${filename}.txt`),
      output,
      'utf8'
    );
    console.log(`Análisis escrito en results-${filename}.txt`);

    return {
      success: true,
      duplicateFields: [...duplicates],
    };
  } catch (err) {
    throw new Error(`Error in extractFormFields: ${err}`);
  }
}

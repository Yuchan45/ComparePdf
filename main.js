import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import {
  transferPdfData,
  getDirectoryFilePaths,
  logResults,
} from './transferPdfData/transferData.js';

async function extractFormFields(pdfPath1, pdfPath2) {
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
  fs.writeFileSync(
    './resources/compare/uniqueFieldsI485.txt',
    uniqueFieldsText
  );
  console.log('Los campos únicos han sido guardados en uniqueFields.txt!');
}

/**
 * Dado un array de fieldNames(ids) dentro de un archivo .txt
 * Recorre un pdf y rellena con un 'texto' a definir aquellos campos cuyo fieldId se encuentre dentro del array.
 * Se utilizo para marcar en un pdf destino los campos que deberian llegar de parte del pdf origen.
 */
async function prefillPdf(fieldIdsSourcePath, sourcePdfPath) {
  // Read fieldIds
  let fieldIds = [];
  try {
    const data = fs.readFileSync(fieldIdsSourcePath, 'utf8');
    // Procesar el contenido para obtener el array de {fieldIds, PDFinputType}
    fieldIds = data.split('\n').map((line) => {
      const [name, inputType] = line.split(',').map((part) => part.trim());
      return { name, inputType };
    });
  } catch (err) {
    console.error('Error al leer el archivo con los fields:', err);
  }

  // Read and load the pdf to prefill
  const fileBytes = fs.readFileSync(sourcePdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const form = pdfDoc.getForm();

  // Prefill pdf
  let failedFields = [];
  fieldIds.forEach((field) => {
    const { name, inputType } = field;
    console.log(name, inputType);
    if (!name || name === 'none' || name === undefined) return;

    try {
      if (inputType === 'PDFCheckBox') {
        form.getCheckBox(name).check();
      } else if (inputType === 'PDFDropdown') {
        console.log('Dropdown not supported');
        form.getDropdown(name).select(value);
      } else if (inputType === 'PDFTextField') {
        try {
          let textField = form.getTextField(name);
          textField.setText('E'); // E de equal, field is in both old and new version
        } catch (err) {
          try {
            textField.setText('1');
          } catch (err) {
            logger.error(
              `Error while prefilling PDFTextField! inputType: ${inputType}, name: ${name}`
            );
          }
        }
      } else {
        logger.error(
          `Error while prefilling! Unknown inputType: ${inputType}, name: ${name}`
        );
      }
    } catch (err) {
      console.error(
        `Error while prefilling the field: ${name} and inputType: ${inputType}`
      );
      const failedField = {
        fieldName: name,
        inputType: inputType,
        message: err,
      };
      failedFields.push(failedField);
    }
  });

  // Save the modified PDF
  const modifiedPdfBytes = await pdfDoc.save();

  const destinationPdfPath = './prefillResources/prefilled.pdf'; // Cambia este camino según necesites
  fs.writeFileSync(destinationPdfPath, modifiedPdfBytes);

  console.log('PDF guardado exitosamente en:', destinationPdfPath);
  return failedFields;
}

async function main() {
  try {
    // Reemplazar 'path/to/your/first-form.pdf' y 'path/to/your/second-form.pdf' con las rutas correctas a los archivos PDF
    // extractFormFields(
    //   './resources/compare/I-765-Asylum/Current_I-765_Asylum.pdf',
    //   './resources/compare/I-765-Asylum/New_Unlocked_i-765_Asylum.pdf'
    // );
    // extractFormFields(
    //   './resources/compare/i-485-Update/now_stg_I485.pdf',
    //   './resources/compare/i-485-Update/v5-I-485_2025-01-17.pdf'
    // );
    // prefillPdf(
    //   './resources/prefill/fieldsArrayDoc.txt',
    //   './resources/prefill/new-I-485-2025_01_03-Base.pdf'
    // );
    const logsPath =
      './transferPdfData/resources/outputs/arrayOutputs/logs.txt';
    const inputFilesDirectory =
      './transferPdfData/resources/inputs/arrayInputs';
    const directoryFilePaths = getDirectoryFilePaths(inputFilesDirectory);
    const templatePath =
      './transferPdfData/resources/templates/TemplateEmptyTest.pdf';

    fs.writeFileSync(logsPath, '', { flag: 'w' }); // Restore logs clean

    let successFilesCount = 0;
    let filesWithErrors = 0;
    for (const filePath of directoryFilePaths) {
      const fileName = path.basename(filePath);
      const fileErrors = await transferPdfData(
        filePath,
        templatePath,
        `./transferPdfData/resources/outputs/arrayOutputs/${fileName}`
      );
      logResults(fileName, fileErrors, logsPath);

      fileErrors.failedFieldsCount > 0
        ? filesWithErrors++
        : successFilesCount++;
    }

    console.log('\n\nProcess Finished!\n');
    console.log('Successful Files count:', successFilesCount);
    console.log('Files with some errors:', filesWithErrors);
    console.log('For more information please check logs in:', logsPath, '\n');
  } catch (err) {
    console.error('Error in main', err);
  }
}

main();

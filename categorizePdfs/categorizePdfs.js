import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

import { getFormFields } from '../transferPdfData/transferData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dado un grupo de archivos,
 * Devuelve los archivos que tienen la misma estructura (fileId y fileType),
 * Un pdf es igual a otro sii:
 * - La cantidad de campos entre ambos es igual
 * - Los fieldIds y tipo de campos en ambos es igual
 *
 * Ejemplo de retorno:
 * [
 *   [ 'input1-copy.pdf', 'input1-copy2.pdf', 'input1.pdf' ], // Grupo 1
 *   [ 'input2.pdf' ] // Grupo 2
 * ]
 */
export async function categorizePdfs(directoryFilePaths, logsPath) {
  try {
    const files = [];
    for (const filePath of directoryFilePaths) {
      const fileName = path.basename(filePath);

      // Read and load the current pdf
      const currentFileBytes = fs.readFileSync(filePath);
      const currentPdfDoc = await PDFDocument.load(currentFileBytes, {
        ignoreEncryption: true,
      });
      const currentForm = currentPdfDoc.getForm();

      const currentPdfFields = getFormFields(currentForm);
      const file = {
        fileName: fileName,
        fields: currentPdfFields,
      };
      files.push(file);
    }
    // Tests realizados '/resources/tests/testFiles.json5'
    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = dirname(__filename);
    // const filePath = path.resolve(__dirname, './resources/tests/testFiles.json5');
    // const jsonData = fs.readFileSync(filePath, 'utf8');
    // const testFiles = JSON5.parse(jsonData);

    // const result = groupFiles(testFiles);

    const result = groupFiles(files);
    return result;
  } catch (err) {
    throw Error(`Error in categorizePdfs: ${err}`);
  }
}

function groupFiles(files) {
  try {
    const groups = {};

    files.forEach((file) => {
      // Normalizar los fields
      const normalizedFields = file.fields.map((field) => ({
        fieldId: field.fieldId,
        fieldType: field.fieldType,
      }));

      // Crear un array de identificadores únicos y ordenados por id
      // 'key' es un string formado por todos los fieldId+fieldType del pdf.
      // Ej: '[{"fieldId":"FamilyName","fieldType":"PDFText"},{"fieldId":"MiddleName","fieldType":"PDFText"}]'
      const key = JSON.stringify(
        normalizedFields.sort((a, b) => a.fieldId.localeCompare(b.fieldId))
      );

      // Se agrupan los keys (strings) iguales.
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(file.fileName);
    });

    // Convertir el objeto en un array de grupos
    const categorizedFiles = Object.values(groups);
    return categorizedFiles;
  } catch (err) {
    throw Error(`Error in groupFiles: ${err}`);
  }
}

/**
 * Dado un array con arrays que agrupan los files (por fileName) que son iguales
 * Ej:
 * [
 *   [ 'input1-copy.pdf', 'input1-copy2.pdf', 'input1.pdf' ], // Grupo 1
 *   [ 'input2.pdf' ] // Grupo 2
 * ]
 *
 * Copia los files de la carpeta de inputs que son iguales y los agrupa dentro de
 * una carpeta '/outputs/group_n'
 */
export function organizeFilesByGroups(groups) {
  try {
    const inputDir = path.resolve(__dirname, './resources/inputs');
    const outputDir = path.resolve(__dirname, './resources/outputs');
    // Crear la carpeta de outputs si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    groups.forEach((group, index) => {
      const groupDir = path.join(outputDir, `grupo_${index + 1}`);

      // Crear la carpeta del grupo si no existe
      if (!fs.existsSync(groupDir)) {
        fs.mkdirSync(groupDir);
      }

      group.forEach((fileName) => {
        // Verifica en 'inputs'
        const inputFilePath = path.join(inputDir, fileName);
        if (fs.existsSync(inputFilePath)) {
          fs.copyFileSync(inputFilePath, path.join(groupDir, fileName));
        }

        // Verifica en 'outputs'
        const outputFilePath = path.join(outputDir, fileName);
        if (fs.existsSync(outputFilePath)) {
          fs.copyFileSync(outputFilePath, path.join(groupDir, fileName));
        }
      });
    });
    console.log(
      `Input files have been successfully categorized/grouped in the outputs folder!`
    );
  } catch (err) {
    console.error(`Error in organizeFilesByGroups: ${err.message}`);
    throw Error(`Error in organizeFilesByGroups: ${err.message}`);
  }
}

import fs from 'fs';
import path from 'path';

import { PDFDocument } from 'pdf-lib';

/**
 * Dado un pdf de origen y un pdf de destino
 * Se obtienen todos los campos del pdf origen (fieldId: value) y se prefillean en el pdf destino
 * en aquellos campos, cuyo fieldId coincide, con el valor correspondiente.
 * Devuelve un pdf "outputPdf".
 */
export async function transferPdfData(
  sourcePdfPath,
  templatePdfPath,
  destinationPdfPath
) {
  // Read and load the (source) pdf
  const sourceFileBytes = fs.readFileSync(sourcePdfPath);
  const sourcePdfDoc = await PDFDocument.load(sourceFileBytes, {
    ignoreEncryption: true,
  });
  const sourceForm = sourcePdfDoc.getForm();

  // Read and load the pdf to prefill (template)
  const templateFileBytes = fs.readFileSync(templatePdfPath);
  const templatePdf = await PDFDocument.load(templateFileBytes, {
    ignoreEncryption: true,
  });

  const sourcePdfFields = getFormFields(sourceForm);
  // console.log('Fields obtained from source pdf to insert:', sourcePdfFields);
  const { modifiedPdf: prefilledPdfBytes, failedFields } = await insertFields(
    templatePdf,
    sourcePdfFields
  );

  const fileErrors = {
    failedFieldsCount: failedFields.length,
    failedFields,
  };
  // console.log('FailedFields: ', fileErrors);
  fs.writeFileSync(destinationPdfPath, prefilledPdfBytes);
  // console.log('PDF successfully saved in:', destinationPdfPath);
  return fileErrors;
}

/**
 * Given a pdf-lib form,
 * It returns an array with { fieldId, fieldType, value }
 */
export function getFormFields(form) {
  try {
    const fields = form.getFields();
    let resultFields = [];

    fields.forEach((field) => {
      const fieldType = field.constructor.name;
      const fieldId = field.getName();

      let value;
      try {
        switch (fieldType) {
          case 'PDFCheckBox':
            value = form.getCheckBox(fieldId).isChecked()
              ? 'Checked'
              : 'Unchecked';
            break;
          case 'PDFDropdown':
            value = form.getDropdown(fieldId).getSelected();
            break;
          case 'PDFTextField':
            value = form.getTextField(fieldId).getText();
            break;
          case 'PDFRadioGroup':
            const radioGroup = form.getRadioGroup(fieldId);
            value = radioGroup.getSelected();
            break;
          default:
            console.error(`Unknown fieldType: ${fieldType}, name: ${fieldId}`);
            return;
        }
      } catch (err) {
        console.error(
          `Error processing field ${fieldId} (${fieldType}): ${err.message}`
        );
        return;
      }

      resultFields.push({ fieldId, fieldType, value });
    });

    return resultFields;
  } catch (err) {
    console.error(`Error in getFormFields: ${err.message}`);
  }
}

/**
 * Given a pdf-lib form-bytes and an array of fields [{fieldId, fieldType, value}, ...]
 * It prefills, saves and return the modified bytes in order to write and save in a document.
 */
export async function insertFields(pdfToPrefill, fields) {
  const form = pdfToPrefill.getForm();
  let failedFields = [];

  fields.forEach((field) => {
    const { fieldId, fieldType, value } = field;

    if (!fieldId || fieldId === 'none') return;

    try {
      switch (fieldType) {
        case 'PDFCheckBox': {
          try {
            if (value === 'Checked') {
              form.getCheckBox(fieldId).check();
            } else {
              form.getCheckBox(fieldId).uncheck(); // O manejar si se desmarca
            }
          } catch (err) {
            console.error(
              `Error processing checkbox ${fieldId}: ${err.message}`
            );
            failedFields.push({
              fieldId,
              fieldType,
              value,
              error: err.message,
            });
          }
          break;
        }

        case 'PDFDropdown': {
          try {
            form.getDropdown(fieldId).select(value);
          } catch (err) {
            console.error(
              `Error processing dropdown ${fieldId}: ${err.message}`
            );
            failedFields.push({
              fieldId,
              fieldType,
              value,
              error: err.message,
            });
          }
          break;
        }

        case 'PDFTextField': {
          try {
            let textField = form.getTextField(fieldId);
            textField.setText(value);
          } catch (err) {
            console.error(
              `Error while prefilling ${fieldType}, fieldId: ${fieldId}, value: ${value}: ${err.message}`
            );
            failedFields.push({
              fieldId,
              fieldType,
              value,
              error: err.message,
            });
          }
          break;
        }

        case 'PDFRadioGroup': {
          try {
            const radioGroup = form.getRadioGroup(fieldId);
            if (value) {
              radioGroup.select(value);
            } else {
              console.error(`Value is not provided for radio group ${fieldId}`);
              failedFields.push({
                fieldId,
                fieldType,
                value,
                error: err.message,
              });
            }
          } catch (err) {
            console.error(
              `Error processing radio group ${fieldId}: ${err.message}`
            );
            failedFields.push({
              fieldId,
              fieldType,
              value,
              error: err.message,
            });
          }
          break;
        }

        default: {
          console.error(
            `Error while prefilling! Unknown fieldType: ${fieldType}, fieldId: ${fieldId}, value: ${value}`
          );
          failedFields.push({
            fieldId,
            fieldType,
            value,
            error: 'Unknown field type',
          });
        }
      }
    } catch (err) {
      console.error(
        `Error while processing field: ${fieldId}, fieldType: ${fieldType}, value: ${value}`
      );
      failedFields.push({ fieldId, fieldType, value, error: err.message });
    }
  });

  // Save the modified PDF
  const modifiedPdf = await pdfToPrefill.save();
  return {
    modifiedPdf,
    failedFields,
  };
}

export function getDirectoryFilePaths(directory) {
  const filePaths = [];

  // Leer todos los archivos y carpetas en el directorio
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    // Construir la ruta completa del archivo
    const filePath = path.join(directory, file);

    // Verificar si es un archivo (no un directorio)
    if (fs.statSync(filePath).isFile()) {
      filePaths.push(filePath);
    }
  });

  return filePaths;
}

export function logResults(fileName, fileErrors, logsPath) {
  let content;

  // Creación del contenido basado en los errores
  if (fileErrors.failedFieldsCount > 0) {
    content = {
      fileName: fileName,
      message: 'File transferred with some ERRORS!',
      failedFields: fileErrors,
    };
  } else {
    content = {
      fileName: fileName,
      message: 'File transferred its information successfully',
      failedFields: fileErrors,
    };
  }

  try {
    // Verificar si el archivo ya existe y leer su contenido
    let existingLogs = [];
    if (
      fs.existsSync(logsPath) &&
      fs.readFileSync(logsPath, 'utf8').trim() !== ''
    ) {
      const data = fs.readFileSync(logsPath, 'utf8');
      existingLogs = JSON.parse(data); // Parsear JSON existente
    }

    // Agregar el nuevo contenido al array existente
    existingLogs.push(content);

    // Escribir el array completo de nuevo en el archivo en formato JSON
    fs.writeFileSync(logsPath, JSON.stringify(existingLogs, null, 2));
    console.log(content);
  } catch (err) {
    console.error('Error while processing the log file:', err);
  }
}

import fs from 'fs';
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
  const sourcePdfDoc = await PDFDocument.load(sourceFileBytes);
  const sourceForm = sourcePdfDoc.getForm();

  // Read and load the pdf to prefill (template)
  const templateFileBytes = fs.readFileSync(templatePdfPath);
  const templatePdf = await PDFDocument.load(templateFileBytes);

  const sourcePdfFields = getFormFields(sourceForm);
  console.log('Fields obtained from source pdf to insert:', sourcePdfFields);
  const { modifiedPdf: prefilledPdfBytes, failedFields } = await insertFields(
    templatePdf,
    sourcePdfFields
  );

  console.log('FailedFields: ', failedFields);
  fs.writeFileSync(destinationPdfPath, prefilledPdfBytes);
  console.log('PDF guardado exitosamente en:', destinationPdfPath);
  return sourcePdfFields;
}

/**
 * Given a pdf-lib form,
 * It returns an array with { fieldId, fieldType, value }
 */
function getFormFields(form) {
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
async function insertFields(pdfToPrefill, fields) {
  const form = pdfToPrefill.getForm();
  let failedFields = [];

  fields.forEach((field) => {
    const { fieldId, fieldType, value } = field;

    if (!fieldId || fieldId === 'none') return;

    try {
      switch (fieldType) {
        case 'PDFCheckBox': {
          if (value === 'Checked') {
            form.getCheckBox(fieldId).check();
          } else {
            form.getCheckBox(fieldId).uncheck(); // O manejar si se desmarca
          }
          break;
        }

        case 'PDFDropdown': {
          form.getDropdown(fieldId).select(value);
          break;
        }

        case 'PDFTextField': {
          try {
            let textField = form.getTextField(fieldId);
            textField.setText(value); // Asegúrate de que este método es el correcto
          } catch (err) {
            console.error(
              `Error while prefilling ${fieldType}, fieldId: ${fieldId}, value: ${value}: ${err.message}`
            );
          }
          break;
        }

        case 'PDFRadioGroup': {
          const radioGroup = form.getRadioGroup(fieldId);
          if (value) {
            radioGroup.select(value); // Asegúrate de que este método existe y preselecciona el valor
          } else {
            console.error(`Value is not provided for radio group ${fieldId}`);
          }
          break;
        }

        default: {
          console.error(
            `Error while prefilling! Unknown fieldType: ${fieldType}, fieldId: ${fieldId}, value: ${value}`
          );
        }
      }
    } catch (err) {
      console.error(
        `Error while prefilling the field: ${fieldId}, fieldType: ${fieldType}, value: ${value}`
      );
      const failedField = {
        fieldId,
        fieldType,
        value,
        error: err,
      };
      failedFields.push(failedField);
    }
  });

  // Save the modified PDF
  const modifiedPdf = await pdfToPrefill.save();
  return {
    modifiedPdf,
    failedFields,
  };
}

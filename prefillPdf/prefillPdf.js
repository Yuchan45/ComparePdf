import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Dado un array de fieldNames(ids) dentro de un archivo .txt
 * Recorre un pdf y rellena con un 'texto' a definir aquellos campos cuyo fieldId se encuentre dentro del array.
 * Se utilizo para marcar en un pdf destino los campos que deberian llegar de parte del pdf origen.
 */
export async function prefillPdf(
  fieldIdsSourcePath,
  sourcePdfPath,
  destinationPdfPath
) {
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

  fs.writeFileSync(destinationPdfPath, modifiedPdfBytes);

  console.log('PDF guardado exitosamente en:', destinationPdfPath);
  return failedFields;
}

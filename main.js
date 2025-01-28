const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

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

/**
 * Dado un pdf de origen y un pdf de destino
 * Se obtienen todos los campos del pdf origen (fieldId: value) y se prefillean en el pdf destino
 * en aquellos campos, cuyo fieldId coincide, con el valor correspondiente.
 * Devuelve un pdf "outputPdf".
 */
async function transferPdfData(
  sourcePdfPath,
  templatePdfPath,
  destinationPdfPath
) {
  // Read and load the (source) pdf
  const sourceFileBytes = fs.readFileSync(sourcePdfPath);
  const sourcePdfDoc = await PDFDocument.load(sourceFileBytes);
  const sourceForm = sourcePdfDoc.getForm();

  // Read and load the pdf to prefill (template)
  const targetFileBytes = fs.readFileSync(templatePdfPath);
  const targetPdfDoc = await PDFDocument.load(targetFileBytes);

  const sourcePdfFields = getFormFields(sourceForm);
  const modifiedTargetPdfBytes = await insertFields(
    targetPdfDoc,
    sourcePdfFields
  );

  fs.writeFileSync(destinationPdfPath, modifiedTargetPdfBytes);
  console.log('Fields in source .pdf file:\n', sourcePdfFields);
  console.log('PDF guardado exitosamente en:', destinationPdfPath);
  return sourcePdfFields;
}

/**
 * Given a pdf-lib form,
 * It returns an array with { fieldId, fieldType, value }
 */
function getFormFields(form) {
  const fields = form.getFields();

  let resultFields = [];
  fields.forEach((field) => {
    const fieldType = field.constructor.name;
    const fieldId = field.getName();

    let value;
    if (fieldType === 'PDFCheckBox') {
      value = form.getCheckBox(fieldId).isChecked() ? 'Checked' : 'Unchecked';
    } else if (fieldType === 'PDFDropdown') {
      value = form.getDropdown(fieldId).getSelected();
    } else if (fieldType === 'PDFTextField') {
      value = form.getTextField(fieldId).getText();
    } else {
      logger.error(
        `Error while prefilling! Unknown fieldType: ${fieldType}, name: ${fieldId}`
      );
    }

    resultFields.push({ fieldId, fieldType, value });
  });

  return resultFields;
}

/**
 * Given a pdf-lib form-bytes and an array of fields [{fieldId, fieldType, value}, ...]
 * It prefills, saves and return the modified bytes in order to write and save in a document.
 */
async function insertFields(targetPdfDoc, fields) {
  const form = targetPdfDoc.getForm();
  let failedFields = [];

  fields.forEach((field) => {
    const { fieldId, fieldType, value } = field;

    if (!fieldId || fieldId === 'none') return;

    try {
      if (fieldType === 'PDFCheckBox') {
        if (value === 'Checked') {
          form.getCheckBox(fieldId).check();
        }
      } else if (fieldType === 'PDFDropdown') {
        form.getDropdown(fieldId).select(value);
      } else if (fieldType === 'PDFTextField') {
        try {
          let textField = form.getTextField(fieldId);
          textField.setText(value); // E de equal, field is in both old and new version
        } catch (err) {
          logger.error(
            `Error while prefilling ${fieldType}, fieldId: ${fieldId}, value: ${value}`
          );
        }
      } else {
        logger.error(
          `Error while prefilling! Unknown fieldType: ${fieldType}, fieldId: ${fieldId}, value: ${value}`
        );
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
  return await targetPdfDoc.save();
}

async function main() {
  // Asegúrate de reemplazar 'path/to/your/first-form.pdf' y 'path/to/your/second-form.pdf' con las rutas correctas a los archivos PDF
  // extractFormFields(
  //   './resources/compare/old-vawa-i485.pdf',
  //   './resources/compare/stage-I485.pdf'
  // );
  // prefillPdf(
  //   './resources/prefill/fieldsArrayDoc.txt',
  //   './resources/prefill/new-I-485-2025_01_03-Base.pdf'
  // );

  transferPdfData(
    './resources/transferPdfData/test-source-filled-just-some-checkbox-i485.pdf',
    './resources/transferPdfData/test-target-i485.pdf',
    './resources/transferPdfData/results/newPdf2.pdf'
  );
}

main();

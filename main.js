import fs from 'fs';
import path from 'path';

import {
  transferPdfData,
  getDirectoryFilePaths,
  logResults,
} from './transferPdfData/transferData.js';
import {
  categorizePdfs,
  organizeFilesByGroups,
} from './categorizePdfs/categorizePdfs.js';
import { extractFormFields } from './comparePdfs/comparePdfs.js';
import { prefillPdf } from './prefillPdf/prefillPdf.js';

async function main() {
  try {
    /*
    // Compare Pdf
    // Reemplazar el 1er y 2do arg por los pdf a comparar
    const logPath = './comparePdfs';
    const result = await extractFormFields(
      './comparePdfs/resources/I-765-Asylum/Current_I-765_Asylum.pdf',
      './comparePdfs/resources/I-765-Asylum/New_Unlocked_i-765_Asylum.pdf',
      logPath
    );
    */
    /*
    // Prefill Pdf
    const prefilledFilePath = './prefillPdf/resources/prefilled.pdf';
    prefillPdf(
      './prefillPdf/resources/fieldsArrayDoc.txt',
      './prefillPdf/resources/new-I-485-2025_01_03-Base.pdf',
      prefilledFilePath
    );
    */
    /*
    // Transfer Pdf Data
    const logsPath = './transferPdfData/resources/outputs/logs.json';
    const inputFilesDirectory =
      './transferPdfData/resources/inputs/arrayInputsAndy';
    const directoryFilePaths = getDirectoryFilePaths(inputFilesDirectory);
    const templatePath =
      './transferPdfData/resources/templates/I-765-Template_unlocked.pdf';

    fs.writeFileSync(logsPath, '', { flag: 'w' }); // Restore logs clean

    let successFilesCount = 0;
    let filesWithErrors = 0;
    for (const filePath of directoryFilePaths) {
      const fileName = path.basename(filePath);
      const fileErrors = await transferPdfData(
        filePath,
        templatePath,
        `./transferPdfData/resources/outputs/arrayOutputsAndy/${fileName}`
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
    */

    // Categorize pdfs
    const logsPath = './categorizePdfs/resources/logs.txt';
    const directoryFilePaths = getDirectoryFilePaths(
      './categorizePdfs/resources/inputs'
    );
    const fileGroups = await categorizePdfs(directoryFilePaths, logsPath);
    console.log('Files that have the same structure:\n', fileGroups);

    organizeFilesByGroups(fileGroups);
  } catch (err) {
    console.error('Error in main', err);
  }
}

main();

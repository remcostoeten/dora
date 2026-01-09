import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';

const exportToCsv = async (data: Record<string, any>[], outputPath: string, columns: string[]): Promise<void> => {
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: columns.map(col => ({ id: col, title: col }))
  });

  await csvWriter.writeRecords(data);
};

export { exportToCsv };
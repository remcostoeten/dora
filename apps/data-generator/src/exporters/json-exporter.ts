import { TableSchema } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const exportToJson = (data: Record<string, any>[], outputPath: string, compress = false): void => {
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonData = JSON.stringify(data, null, 2);

  if (compress) {
    fs.writeFileSync(outputPath, JSON.stringify(data));
  } else {
    fs.writeFileSync(outputPath, jsonData);
  }
};

const generateTypeScriptTypes = (schema: TableSchema): string => {
  const interfaceName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
  const properties = schema.columns.map(col => {
    let tsType = 'any';
    const type = col.type;

    const stringTypes = ['firstName', 'lastName', 'fullName', 'email', 'username', 'password', 'sentence', 'paragraph', 'word', 'slug', 'date', 'futureDate', 'pastDate', 'recentDate', 'timestamp', 'url', 'domainName', 'ipAddress', 'userAgent', 'uuid', 'phoneNumber', 'streetAddress', 'city', 'country', 'zipCode', 'state', 'companyName', 'jobTitle', 'department', 'productName', 'productDescription', 'category', 'imageUrl', 'avatarUrl', 'literal'];
    const numberTypes = ['integer', 'float', 'price', 'percentage', 'latitude', 'longitude', 'range'];
    const booleanTypes = ['boolean'];
    const jsonTypes = ['json'];

    if (stringTypes.includes(type)) {
      tsType = 'string';
    } else if (numberTypes.includes(type)) {
      tsType = 'number';
    } else if (booleanTypes.includes(type)) {
      tsType = 'boolean';
    } else if (jsonTypes.includes(type)) {
      tsType = 'Record<string, any>';
    }

    const optional = col.constraints?.notNull ? '' : '?';
    return `  ${col.name}${optional}: ${tsType};`;
  }).join('\n');

  return `export interface ${interfaceName} {\n${properties}\n}`;
};

const exportToTypeScript = (schema: TableSchema, outputPath: string): void => {
  const types = generateTypeScriptTypes(schema);
  fs.writeFileSync(outputPath, types);
};

export { exportToJson, exportToTypeScript, generateTypeScriptTypes };
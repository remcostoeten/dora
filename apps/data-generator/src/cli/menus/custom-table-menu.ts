import { text, select, confirm, multiselect } from '@clack/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { generateRows } from '../../generators/schema-builder';
import { exportToJson, exportToTypeScript } from '../../exporters/json-exporter';
import { exportToCsv } from '../../exporters/csv-exporter';
import { exportToSql, exportToPrismaSchema } from '../../exporters/sql-exporter';
import { ColumnDefinition, TableSchema, GenerationConfig, FakerType } from '../../types';
import validators from '../../utils/validators';
import formatters from '../../utils/formatters';
import logger from '../../utils/logger';
import settings from '../../config/settings';

export async function handleCustomTableBuilder() {
  console.clear();
  console.log(chalk.cyan.bold('\n🛠️ Custom Table Builder\n'));

  const tableName = await text({
    message: 'Enter table name:',
    placeholder: 'my_table',
    validate: (value: string) => {
      const result = validators.tableName(value);
      return result.valid ? undefined : result.error;
    }
  });

  if (typeof tableName !== 'string') return;

  const columns: ColumnDefinition[] = [];
  let addMoreColumns = true;

  while (addMoreColumns) {
    console.log(chalk.yellow(`\nColumn ${columns.length + 1}`));

    const colName = await text({
      message: 'Column name:',
      placeholder: 'fieldName',
      validate: (value: string) => {
        const result = validators.columnName(value);
        return result.valid ? undefined : result.error;
      }
    });

    if (typeof colName !== 'string') return;

    const colType = await select({
      message: 'Select data type:',
      options: [
        { value: 'firstName', label: 'First Name', group: 'Text' },
        { value: 'lastName', label: 'Last Name', group: 'Text' },
        { value: 'fullName', label: 'Full Name', group: 'Text' },
        { value: 'email', label: 'Email', group: 'Text' },
        { value: 'username', label: 'Username', group: 'Text' },
        { value: 'password', label: 'Password', group: 'Text' },
        { value: 'sentence', label: 'Sentence', group: 'Text' },
        { value: 'paragraph', label: 'Paragraph', group: 'Text' },
        { value: 'word', label: 'Word', group: 'Text' },
        { value: 'slug', label: 'Slug', group: 'Text' },
        { value: 'integer', label: 'Integer', group: 'Numbers' },
        { value: 'float', label: 'Float', group: 'Numbers' },
        { value: 'price', label: 'Price', group: 'Numbers' },
        { value: 'percentage', label: 'Percentage', group: 'Numbers' },
        { value: 'date', label: 'Date', group: 'Dates' },
        { value: 'futureDate', label: 'Future Date', group: 'Dates' },
        { value: 'pastDate', label: 'Past Date', group: 'Dates' },
        { value: 'timestamp', label: 'Timestamp', group: 'Dates' },
        { value: 'url', label: 'URL', group: 'Internet' },
        { value: 'domainName', label: 'Domain Name', group: 'Internet' },
        { value: 'ipAddress', label: 'IP Address', group: 'Internet' },
        { value: 'userAgent', label: 'User Agent', group: 'Internet' },
        { value: 'uuid', label: 'UUID', group: 'Internet' },
        { value: 'phoneNumber', label: 'Phone Number', group: 'Contact' },
        { value: 'streetAddress', label: 'Street Address', group: 'Address' },
        { value: 'city', label: 'City', group: 'Address' },
        { value: 'country', label: 'Country', group: 'Address' },
        { value: 'zipCode', label: 'Zip Code', group: 'Address' },
        { value: 'state', label: 'State', group: 'Address' },
        { value: 'companyName', label: 'Company Name', group: 'Business' },
        { value: 'jobTitle', label: 'Job Title', group: 'Business' },
        { value: 'department', label: 'Department', group: 'Business' },
        { value: 'productName', label: 'Product Name', group: 'Commerce' },
        { value: 'productDescription', label: 'Product Description', group: 'Commerce' },
        { value: 'category', label: 'Category', group: 'Commerce' },
        { value: 'imageUrl', label: 'Image URL', group: 'Media' },
        { value: 'avatarUrl', label: 'Avatar URL', group: 'Media' },
        { value: 'boolean', label: 'Boolean', group: 'Types' },
        { value: 'json', label: 'JSON', group: 'Types' },
        { value: 'literal', label: 'Literal/Custom', group: 'Types' }
      ]
    }) as FakerType;

    if (typeof colType !== 'string') return;

    const useConstraints = await confirm({
      message: 'Add constraints?',
      initialValue: false
    });

    const constraints: any = {};

    if (useConstraints) {
      const constraintOptions = await multiselect({
        message: 'Select constraints:',
        options: [
          { value: 'primaryKey', label: 'Primary Key' },
          { value: 'unique', label: 'Unique' },
          { value: 'notNull', label: 'Not Null' },
          { value: 'defaultValue', label: 'Default Value' }
        ],
        required: false
      });

      if (Array.isArray(constraintOptions)) {
        if (constraintOptions.includes('primaryKey')) {
          constraints.primaryKey = true;
        }
        if (constraintOptions.includes('unique')) {
          constraints.unique = true;
        }
        if (constraintOptions.includes('notNull')) {
          constraints.notNull = true;
        }
        if (constraintOptions.includes('defaultValue')) {
          const defaultValue = await text({
            message: 'Default value:',
            placeholder: 'null'
          });

          if (typeof defaultValue === 'string') {
            constraints.defaultValue = defaultValue;
          }
        }

        if (['integer', 'float', 'price', 'percentage'].includes(colType)) {
          const useRange = await confirm({
            message: 'Set min/max values?',
            initialValue: true
          });

          if (useRange) {
            const minInput = await text({
              message: 'Minimum value:',
              placeholder: '0',
              defaultValue: '0'
            });

            const maxInput = await text({
              message: 'Maximum value:',
              placeholder: '1000',
              defaultValue: '1000'
            });

            if (typeof minInput === 'string' && typeof maxInput === 'string') {
              constraints.min = parseInt(minInput);
              constraints.max = parseInt(maxInput);
            }
          }
        }
      }
    }

    columns.push({
      name: colName,
      type: colType,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined
    });

    const result = await confirm({
      message: 'Add another column?',
      initialValue: false
    });

    if (typeof result === 'symbol') {
      return;
    }

    addMoreColumns = result;
  }

  if (columns.length === 0) {
    logger.error('No columns defined');
    return;
  }

  console.log(chalk.yellow('\nTable Schema:'));
  console.log(`Name: ${tableName}`);
  console.log('Columns:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
    if (col.constraints) {
      console.log(`    Constraints: ${JSON.stringify(col.constraints)}`);
    }
  });

  const confirmSchema = await confirm({
    message: 'Generate data with this schema?',
    initialValue: true
  });

  if (!confirmSchema) {
    logger.info('Cancelled');
    return;
  }

  const rowCountInput = await text({
    message: 'Number of rows to generate:',
    placeholder: '100',
    defaultValue: settings.get('defaultRowCount').toString()
  });

  if (typeof rowCountInput !== 'string') return;

  const rowCount = parseInt(rowCountInput);
  const validationResult = validators.rowCount(rowCount);
  if (!validationResult.valid) {
    logger.error(validationResult.error || 'Invalid row count');
    return;
  }

  const locale = settings.get('defaultLocale');

  const exportFormat = await select({
    message: 'Select export format:',
    options: [
      { value: 'json', label: 'JSON' },
      { value: 'csv', label: 'CSV' },
      { value: 'sql', label: 'SQL' },
      { value: 'typescript', label: 'TypeScript Types' },
      { value: 'prisma', label: 'Prisma Schema' }
    ]
  });

  if (typeof exportFormat !== 'string') return;

  const outputInput = await text({
    message: 'Output file path:',
    placeholder: `./output/${tableName}.${exportFormat}`
  });

  if (typeof outputInput !== 'string') return;

  const schema: TableSchema = {
    name: tableName,
    columns
  };

  const spinner = ora(chalk.cyan('Generating data...')).start();
  const startTime = Date.now();

  try {
    const config: GenerationConfig = {
      rowCount,
      locale,
      batchSize: settings.get('defaultBatchSize')
    };

    const data = generateRows(schema, rowCount, locale);

    switch (exportFormat) {
      case 'json':
        exportToJson(data, outputInput);
        break;
      case 'csv':
        await exportToCsv(data, outputInput, columns.map(col => col.name));
        break;
      case 'sql':
        exportToSql(schema, data, outputInput, 'sqlite');
        break;
      case 'typescript':
        exportToTypeScript(schema, outputInput);
        break;
      case 'prisma':
        exportToPrismaSchema(schema, outputInput);
        break;
    }

    const timeElapsed = Date.now() - startTime;

    spinner.stop();

    logger.success(`Generated ${formatters.number(rowCount)} rows in ${formatters.timeElapsed(timeElapsed)}`);
    logger.info(`Data exported to: ${outputInput}`);

    const savePreset = await confirm({
      message: 'Save as preset?',
      initialValue: false
    });

    if (savePreset) {
      const presetName = await text({
        message: 'Preset name:',
        placeholder: tableName
      });

      if (typeof presetName === 'string') {
        const customPresets = settings.get('customPresets') || [];
        customPresets.push({
          name: presetName,
          description: `Custom preset for ${tableName}`,
          schema,
          defaultRowCount: rowCount
        });
        settings.set('customPresets', customPresets);
        logger.success(`Preset saved as: ${presetName}`);
      }
    }

  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to generate data: ${error.message}`);
  }
}
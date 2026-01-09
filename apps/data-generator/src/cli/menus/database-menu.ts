import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { DatabaseConnection } from '../../types';
import validators from '../../utils/validators';
import logger from '../../utils/logger';
import ora from 'ora';
import { testConnection as testSqlite } from '../../database/connectors/sqlite-connector';
import { testConnection as testPostgres } from '../../database/connectors/postgresql-connector';
import { testConnection as testMysql } from '../../database/connectors/mysql-connector';
import settings from '../../config/settings';

export async function handleDatabaseConnection() {
  console.clear();
  console.log(chalk.cyan.bold('\n🔌 Database Connection\n'));

  const dbType = await select({
    message: 'Select database type:',
    options: [
      { value: 'sqlite', label: 'SQLite' },
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'mysql', label: 'MySQL' },
      { value: 'back', label: '← Back' }
    ]
  });

  if (typeof dbType !== 'string' || dbType === 'back') return;

  let connection: DatabaseConnection | undefined;

  switch (dbType) {
    case 'sqlite':
      connection = await configureSQLite();
      break;
    case 'postgresql':
      connection = await configurePostgreSQL();
      break;
    case 'mysql':
      connection = await configureMySQL();
      break;
    default:
      return;
  }

  if (!connection) return;

  const testConnection = await confirm({
    message: 'Test connection?',
    initialValue: true
  });

  if (testConnection) {
    const spinner = ora(chalk.cyan('Testing connection...')).start();

  try {
    let success = false;

    if (connection.type === 'sqlite') {
      success = testSqlite(connection);
    } else if (connection.type === 'postgresql') {
      success = await testPostgres(connection);
    } else if (connection.type === 'mysql') {
      success = await testMysql(connection);
    }

      spinner.stop();

      if (success) {
        logger.success('Connection successful!');
      } else {
        logger.error('Connection failed');
        return;
      }
    } catch (error: any) {
      spinner.stop();
      logger.error(`Connection error: ${error.message}`);
      return;
    }
  }

  const saveConnection = await confirm({
    message: 'Save connection configuration?',
    initialValue: false
  });

  if (saveConnection) {
    const connName = await text({
      message: 'Connection name:',
      placeholder: `${connection.type}_connection`
    });

    if (typeof connName === 'string') {
      const connections = settings.get('connections') || {};
      connections[connName] = connection;
      settings.set('connections', connections);
      logger.success(`Connection saved as: ${connName}`);
    }
  }
}

async function configureSQLite(): Promise<DatabaseConnection | undefined> {
  const filePath = await text({
    message: 'Database file path:',
    placeholder: './data/database.sqlite',
    validate: (value: string) => {
      const result = validators.filePath(value);
      return result.valid ? undefined : result.error;
    }
  });

  if (typeof filePath !== 'string') return undefined;

  return {
    type: 'sqlite',
    filePath
  };
}

async function configurePostgreSQL(): Promise<DatabaseConnection | undefined> {
  const useConnectionString = await confirm({
    message: 'Use connection string?',
    initialValue: true
  });

  let connection: DatabaseConnection;

  if (useConnectionString) {
    const connectionString = await text({
      message: 'Connection string:',
      placeholder: 'postgresql://user:password@localhost:5432/mydb',
      validate: (value: string) => {
        const result = validators.connectionString(value);
        return result.valid ? undefined : result.error;
      }
    });

    if (typeof connectionString !== 'string') return undefined;

    connection = {
      type: 'postgresql',
      connectionString
    };
  } else {
    const host = await text({
      message: 'Host:',
      placeholder: 'localhost',
      defaultValue: 'localhost'
    });

    if (typeof host !== 'string') return undefined;

    const portInput = await text({
      message: 'Port:',
      placeholder: '5432',
      defaultValue: '5432'
    });

    if (typeof portInput !== 'string') return undefined;

    const database = await text({
      message: 'Database name:',
      placeholder: 'mydb'
    });

    if (typeof database !== 'string') return undefined;

    const user = await text({
      message: 'Username:',
      placeholder: 'postgres'
    });

    if (typeof user !== 'string') return undefined;

    const password = await text({
      message: 'Password:',
      placeholder: '••••••••'
    });

    if (typeof password !== 'string') return undefined;

    connection = {
      type: 'postgresql',
      host,
      port: parseInt(portInput),
      database,
      user,
      password
    };
  }

  return connection;
}

async function configureMySQL(): Promise<DatabaseConnection | undefined> {
  const useConnectionString = await confirm({
    message: 'Use connection string?',
    initialValue: true
  });

  let connection: DatabaseConnection;

  if (useConnectionString) {
    const connectionString = await text({
      message: 'Connection string:',
      placeholder: 'mysql://user:password@localhost:3306/mydb',
      validate: (value: string) => {
        const result = validators.connectionString(value);
        return result.valid ? undefined : result.error;
      }
    });

    if (typeof connectionString !== 'string') return undefined;

    connection = {
      type: 'mysql',
      connectionString
    };
  } else {
    const host = await text({
      message: 'Host:',
      placeholder: 'localhost',
      defaultValue: 'localhost'
    });

    if (typeof host !== 'string') return undefined;

    const portInput = await text({
      message: 'Port:',
      placeholder: '3306',
      defaultValue: '3306'
    });

    if (typeof portInput !== 'string') return undefined;

    const database = await text({
      message: 'Database name:',
      placeholder: 'mydb'
    });

    if (typeof database !== 'string') return undefined;

    const user = await text({
      message: 'Username:',
      placeholder: 'root'
    });

    if (typeof user !== 'string') return undefined;

    const password = await text({
      message: 'Password:',
      placeholder: '••••••••'
    });

    if (typeof password !== 'string') return undefined;

    connection = {
      type: 'mysql',
      host,
      port: parseInt(portInput),
      database,
      user,
      password
    };
  }

  return connection;
}
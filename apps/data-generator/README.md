# Data Generator CLI

An interactive CLI tool for generating realistic dummy database tables with fake data using Faker.js.

## Features

- 🎨 **Interactive Mode**: Beautiful, user-friendly CLI with colored output and progress bars
- 📦 **Preset Templates**: Ready-to-use schemas for users, products, blog posts, orders, and companies
- 🛠️ **Custom Table Builder**: Create custom tables with comprehensive field types
- 💾 **Multiple Export Formats**: JSON, CSV, SQL, TypeScript types, Prisma schema
- 🗄️ **Database Support**: SQLite, PostgreSQL, MySQL
- ⚙️ **Configurable**: Locale, row count, seed, batch size, and more
- 🔄 **Reproducible Data**: Use seeds to generate consistent data
- 🚀 **High Performance**: Efficient batch processing for large datasets

## Installation

```bash
cd apps/data-generator
npm install
npm run build
npm link
```

## Usage

### Interactive Mode

```bash
data-gen
# or
data-gen interactive
```

### Quick Generate with Preset

```bash
data-gen generate --preset users --rows 1000 --output users.json
```

### Custom Table

```bash
data-gen generate \
  --table products \
  --columns "id:uuid,name:productName,price:price,stock:integer" \
  --rows 500 \
  --format sql \
  --output products.sql
```

### Generate to Database

```bash
# SQLite
data-gen generate --preset users --rows 1000 --database sqlite:./data.db

# PostgreSQL
data-gen generate --preset users --rows 1000 --database "postgresql://user:pass@localhost:5432/mydb"

# MySQL
data-gen generate --preset users --rows 1000 --database "mysql://user:pass@localhost:3306/mydb"
```

### Generate with Seed (Reproducible)

```bash
data-gen generate --preset users --rows 100 --seed 12345 --output users.json
```

## Available Presets

- **users**: User table with common user-related fields (100 rows)
- **products**: E-commerce product table with inventory data (500 rows)
- **posts**: Blog posts with metadata and content (200 rows)
- **orders**: Orders and transactions table (1,000 rows)
- **companies**: Company/organization table with business details (50 rows)

## Data Types

### Text
- firstName, lastName, fullName, email, username, password
- sentence, paragraph, word, slug

### Numbers
- integer, float, price, percentage

### Dates
- date, futureDate, pastDate, recentDate, timestamp

### Internet
- url, domainName, ipAddress, userAgent, uuid

### Contact
- phoneNumber

### Address
- streetAddress, city, country, zipCode, state

### Business
- companyName, jobTitle, department

### Commerce
- productName, productDescription, category

### Media
- imageUrl, avatarUrl

### Types
- boolean, json, literal, range

## Export Formats

- **JSON**: Array of objects with generated data
- **CSV**: Comma-separated values file
- **SQL**: INSERT statements with CREATE TABLE
- **TypeScript**: TypeScript interface definitions
- **Prisma**: Prisma schema definitions

## Database Options

- **--drop-table**: Drop table before inserting
- **--truncate-table**: Truncate table before inserting
- **--batch-size**: Set batch size for inserts (default: 1000)

## Configuration

Manage settings using the config command:

```bash
# Show all settings
data-gen config --show

# Get a setting
data-gen config --get defaultLocale

# Set a setting
data-gen config --set defaultRowCount=500

# Reset to defaults
data-gen config --reset
```

## Supported Locales

English, Spanish, French, German, Japanese, Chinese (Simplified), Portuguese, Russian, Dutch, Swedish, Danish, Norwegian, Finnish, Polish, Ukrainian, Vietnamese, Thai, Indonesian, Malay, Turkish, Arabic, Hebrew, Greek, Czech, Romanian, Hungarian, Slovak.

## CLI Commands

```bash
data-gen [command] [options]

Commands:
  interactive (i)        Run interactive mode
  generate (g)           Generate data using a preset or custom table
  table                  Build custom table schema
  config                 Manage configuration
  presets                List available presets
  locales                List available locales

Options:
  -p, --preset <name>    Use a preset template
  -t, --table <name>     Table name for custom table
  -c, --columns <def>    Column definitions (name:type,name:type)
  -r, --rows <number>    Number of rows to generate (default: 100)
  -l, --locale <code>    Locale for faker data (default: en)
  -s, --seed <number>    Seed for reproducible data
  -f, --format <format>  Export format (json, csv, sql, typescript, prisma)
  -o, --output <path>    Output file path
  -d, --database <conn>  Database connection string
  --batch-size <number>  Batch size for database inserts (default: 1000)
  --drop-table           Drop table before inserting
  --truncate-table       Truncate table before inserting
  -h, --help             Display help for command
```

## Examples

### Generate Users to JSON

```bash
data-gen generate --preset users --rows 100 --output users.json
```

### Generate Products to CSV

```bash
data-gen generate --preset products --rows 500 --format csv --output products.csv
```

### Generate Orders to SQL

```bash
data-gen generate --preset orders --rows 1000 --format sql --output orders.sql
```

### Generate TypeScript Types

```bash
data-gen generate --preset users --format typescript --output user-types.ts
```

### Generate Prisma Schema

```bash
data-gen generate --preset users --format prisma --output schema.prisma
```

### Custom Table with Constraints

```bash
data-gen generate \
  --table customers \
  --columns "id:uuid:primaryKey,name:fullName:notNull,email:email:unique,age:integer" \
  --rows 200 \
  --output customers.json
```

### Generate to SQLite Database

```bash
data-gen generate --preset users --rows 1000 --database sqlite:./database.sqlite
```

### Generate to PostgreSQL

```bash
data-gen generate --preset products --rows 5000 --database "postgresql://user:pass@localhost:5432/shop"
```

## Performance

- Generates 1,000 rows in under 1 second
- Supports 100k+ rows efficiently
- Batch processing for database inserts
- Streaming for large datasets

## Troubleshooting

### Connection Failed

Make sure your database is running and credentials are correct. Test your connection string manually first.

### Out of Memory

For very large datasets (100k+ rows), use:
- Smaller batch sizes: `--batch-size 500`
- Direct database export instead of JSON
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 data-gen ...`

### Invalid Table/Column Names

Table and column names must:
- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Not be SQL reserved keywords

## License

MIT
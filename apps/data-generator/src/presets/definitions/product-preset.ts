import { Preset } from '../../types';

export const productPreset: Preset = {
  name: 'products',
  description: 'E-commerce product table with inventory data',
  defaultRowCount: 500,
  schema: {
    name: 'products',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        constraints: { primaryKey: true, unique: true, notNull: true }
      },
      {
        name: 'name',
        type: 'productName',
        constraints: { notNull: true }
      },
      {
        name: 'description',
        type: 'productDescription'
      },
      {
        name: 'price',
        type: 'price',
        constraints: { notNull: true, min: 1, max: 10000 }
      },
      {
        name: 'category',
        type: 'category',
        constraints: { notNull: true }
      },
      {
        name: 'sku',
        type: 'literal',
        constraints: { unique: true, notNull: true, defaultValue: 'SKU-' }
      },
      {
        name: 'stock',
        type: 'integer',
        constraints: { notNull: true, min: 0, max: 10000 }
      },
      {
        name: 'imageUrl',
        type: 'imageUrl'
      },
      {
        name: 'rating',
        type: 'float',
        constraints: { min: 0, max: 5 }
      },
      {
        name: 'reviews',
        type: 'integer',
        constraints: { min: 0, max: 10000 }
      },
      {
        name: 'manufacturer',
        type: 'companyName'
      },
      {
        name: 'createdAt',
        type: 'timestamp',
        constraints: { notNull: true }
      }
    ]
  }
};
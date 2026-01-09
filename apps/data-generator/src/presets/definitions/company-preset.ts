import { Preset } from '../../types';

export const companyPreset: Preset = {
  name: 'companies',
  description: 'Company/organization table with business details',
  defaultRowCount: 50,
  schema: {
    name: 'companies',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        constraints: { primaryKey: true, unique: true, notNull: true }
      },
      {
        name: 'name',
        type: 'companyName',
        constraints: { notNull: true }
      },
      {
        name: 'industry',
        type: 'category',
        constraints: { notNull: true }
      },
      {
        name: 'employees',
        type: 'integer',
        constraints: { min: 1, max: 100000 }
      },
      {
        name: 'revenue',
        type: 'price',
        constraints: { min: 0, max: 1000000000 }
      },
      {
        name: 'website',
        type: 'url'
      },
      {
        name: 'email',
        type: 'email'
      },
      {
        name: 'phone',
        type: 'phoneNumber'
      },
      {
        name: 'address',
        type: 'streetAddress'
      },
      {
        name: 'city',
        type: 'city'
      },
      {
        name: 'country',
        type: 'country'
      },
      {
        name: 'founded',
        type: 'integer',
        constraints: { min: 1800, max: 2024 }
      },
      {
        name: 'createdAt',
        type: 'timestamp',
        constraints: { notNull: true }
      }
    ]
  }
};
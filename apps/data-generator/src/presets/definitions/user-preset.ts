import { Preset } from '../../types';

export const userPreset: Preset = {
  name: 'users',
  description: 'User table with common user-related fields',
  defaultRowCount: 100,
  schema: {
    name: 'users',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        constraints: { primaryKey: true, unique: true, notNull: true }
      },
      {
        name: 'firstName',
        type: 'firstName',
        constraints: { notNull: true }
      },
      {
        name: 'lastName',
        type: 'lastName',
        constraints: { notNull: true }
      },
      {
        name: 'email',
        type: 'email',
        constraints: { unique: true, notNull: true }
      },
      {
        name: 'username',
        type: 'username',
        constraints: { unique: true, notNull: true }
      },
      {
        name: 'password',
        type: 'password',
        constraints: { notNull: true }
      },
      {
        name: 'avatar',
        type: 'avatarUrl'
      },
      {
        name: 'birthDate',
        type: 'date'
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
        name: 'zipCode',
        type: 'zipCode'
      },
      {
        name: 'createdAt',
        type: 'timestamp',
        constraints: { notNull: true }
      },
      {
        name: 'updatedAt',
        type: 'timestamp',
        constraints: { notNull: true }
      }
    ]
  }
};
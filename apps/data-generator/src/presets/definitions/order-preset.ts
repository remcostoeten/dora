import { Preset } from '../../types';

export const orderPreset: Preset = {
  name: 'orders',
  description: 'Orders and transactions table',
  defaultRowCount: 1000,
  schema: {
    name: 'orders',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        constraints: { primaryKey: true, unique: true, notNull: true }
      },
      {
        name: 'orderId',
        type: 'literal',
        constraints: { unique: true, notNull: true, defaultValue: 'ORD-' }
      },
      {
        name: 'userId',
        type: 'uuid',
        constraints: { notNull: true }
      },
      {
        name: 'amount',
        type: 'price',
        constraints: { notNull: true, min: 1, max: 100000 }
      },
      {
        name: 'currency',
        type: 'literal',
        constraints: { defaultValue: 'USD' }
      },
      {
        name: 'status',
        type: 'literal',
        constraints: { defaultValue: 'pending' }
      },
      {
        name: 'paymentMethod',
        type: 'literal',
        constraints: { defaultValue: 'credit_card' }
      },
      {
        name: 'items',
        type: 'json'
      },
      {
        name: 'shippingAddress',
        type: 'json'
      },
      {
        name: 'createdAt',
        type: 'timestamp',
        constraints: { notNull: true }
      }
    ]
  }
};
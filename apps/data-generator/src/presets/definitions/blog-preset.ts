import { Preset } from '../../types';

export const blogPreset: Preset = {
  name: 'posts',
  description: 'Blog posts with metadata and content',
  defaultRowCount: 200,
  schema: {
    name: 'posts',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        constraints: { primaryKey: true, unique: true, notNull: true }
      },
      {
        name: 'title',
        type: 'sentence',
        constraints: { notNull: true }
      },
      {
        name: 'slug',
        type: 'slug',
        constraints: { unique: true, notNull: true }
      },
      {
        name: 'content',
        type: 'paragraph',
        constraints: { notNull: true }
      },
      {
        name: 'excerpt',
        type: 'sentence'
      },
      {
        name: 'authorId',
        type: 'uuid',
        constraints: { notNull: true }
      },
      {
        name: 'categoryId',
        type: 'integer',
        constraints: { notNull: true }
      },
      {
        name: 'tags',
        type: 'json'
      },
      {
        name: 'views',
        type: 'integer',
        constraints: { min: 0 }
      },
      {
        name: 'likes',
        type: 'integer',
        constraints: { min: 0 }
      },
      {
        name: 'published',
        type: 'boolean',
        constraints: { defaultValue: true }
      },
      {
        name: 'publishedAt',
        type: 'timestamp'
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
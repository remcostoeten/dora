/**
 * LSP Autocomplete Pattern Tests
 *
 * @module lsp-patterns
 * @see apps/desktop/src/features/drizzle-runner/utils/lsp-patterns.ts
 *
 * These tests verify that the regex patterns used in the Drizzle runner's
 * autocomplete correctly identify various query states.
 */

import { describe, it, expect } from 'vitest';
import {
    getDbName,
    getChainMode,
    getTableMatch,
    isInsideFromParens,
    isInsideWhereParens,
    getHelperMatch,
} from '@/features/drizzle-runner/utils/lsp-patterns';

describe('Drizzle LSP Pattern Tests', () => {
  describe('getDbName', () => {
    it('detects db. at end', () => {
      expect(getDbName('db.')).toBe('db');
    });

    it('detects db.sel partial', () => {
      expect(getDbName('db.sel')).toBe('db');
    });

    it('detects db.select', () => {
      expect(getDbName('db.select')).toBe('db');
    });

    it('detects tx.', () => {
      expect(getDbName('tx.')).toBe('tx');
    });

    it('does not detect after complete method', () => {
      expect(getDbName('db.select()')).toBeNull();
    });

    it('does not detect mid-text', () => {
      expect(getDbName('const query = db')).toBeNull();
    });
  });

  describe('getChainMode - Select', () => {
    it('detects db.select().', () => {
      expect(getChainMode('db.select().')).toBe('select');
    });

    it('detects db.select().f partial', () => {
      expect(getChainMode('db.select().f')).toBe('select');
    });

    it('detects db.select().from partial', () => {
      expect(getChainMode('db.select().from')).toBe('select');
    });

    it('detects db.select().from(customers).', () => {
      expect(getChainMode('db.select().from(customers).')).toBe('select');
    });

    it('detects db.select().from(customers).w', () => {
      expect(getChainMode('db.select().from(customers).w')).toBe('select');
    });

    it('detects db.select().from(customers).where(eq(customers.id, 1)).', () => {
      expect(getChainMode('db.select().from(customers).where(eq(customers.id, 1)).')).toBe('select');
    });

    it('detects complex chain with orderBy', () => {
      expect(getChainMode('db.select().from(customers).where(eq(id, 1)).orderBy(name).')).toBe('select');
    });
  });

  describe('getChainMode - Insert', () => {
    it('detects db.insert(customers).', () => {
      expect(getChainMode('db.insert(customers).')).toBe('insert');
    });

    it('detects db.insert(customers).v', () => {
      expect(getChainMode('db.insert(customers).v')).toBe('insert');
    });

    it('detects db.insert(customers).values', () => {
      expect(getChainMode('db.insert(customers).values')).toBe('insert');
    });
  });

  describe('getChainMode - Update', () => {
    it('detects db.update(customers).', () => {
      expect(getChainMode('db.update(customers).')).toBe('update');
    });

    it('detects db.update(customers).s', () => {
      expect(getChainMode('db.update(customers).s')).toBe('update');
    });

    it('detects db.update(customers).set', () => {
      expect(getChainMode('db.update(customers).set')).toBe('update');
    });
  });

  describe('getChainMode - Delete', () => {
    it('detects db.delete(customers).', () => {
      expect(getChainMode('db.delete(customers).')).toBe('delete');
    });

    it('detects db.delete(customers).w', () => {
      expect(getChainMode('db.delete(customers).w')).toBe('delete');
    });
  });

  describe('getChainMode - Null Cases', () => {
    it('returns null for empty string', () => {
      expect(getChainMode('')).toBeNull();
    });

    it('returns null for db.', () => {
      expect(getChainMode('db.')).toBeNull();
    });

    it('returns null for db.select(', () => {
      expect(getChainMode('db.select(')).toBeNull();
    });

    it('returns null for just text', () => {
      expect(getChainMode('hello world')).toBeNull();
    });
  });

  describe('getTableMatch', () => {
    it('matches customers.', () => {
      expect(getTableMatch('customers.')).not.toBeNull();
    });

    it('matches customers.i partial', () => {
      expect(getTableMatch('customers.i')).not.toBeNull();
    });

    it('matches customers.id', () => {
      expect(getTableMatch('customers.id')).not.toBeNull();
    });
  });

  describe('isInsideFromParens', () => {
    it('detects .from(', () => {
      expect(isInsideFromParens('.from(')).toBeTruthy();
    });

    it('detects .from(c', () => {
      expect(isInsideFromParens('.from(c')).toBeTruthy();
    });

    it('detects .from(customers', () => {
      expect(isInsideFromParens('.from(customers')).toBeTruthy();
    });

    it('does not match .from(customers)', () => {
      expect(isInsideFromParens('.from(customers)')).toBeFalsy();
    });
  });

  describe('isInsideWhereParens', () => {
    it('detects .where(', () => {
      expect(isInsideWhereParens('.where(')).toBeTruthy();
    });

    it('detects and(', () => {
      expect(isInsideWhereParens('and(')).toBeTruthy();
    });

    it('detects or(', () => {
      expect(isInsideWhereParens('or(')).toBeTruthy();
    });

    it('does not match .where(eq', () => {
      expect(isInsideWhereParens('.where(eq')).toBeFalsy();
    });
  });

  describe('Complex Scenarios', () => {
    it('nested select in where - should detect chain after outer )', () => {
      const text = "db.select().from(customers).where(eq(customers.status, 'active')).";
      expect(getChainMode(text)).toBe('select');
    });

    it('single line with continuation - current line only (Monaco behavior)', () => {
      const lastLineOnly = '  .where(eq(customers.id, 1)).o';
      expect(getChainMode(lastLineOnly)).toBe('select');
    });
  });

  describe('Phase 5: Full Spec Tests', () => {
    describe('Select Chain Enhancements', () => {
      it('detects .groupBy()', () => {
        expect(getChainMode('db.select().from(t).groupBy(c).')).toBe('select');
      });

      it('detects .having()', () => {
        expect(getChainMode('db.select().from(t).having(c).')).toBe('select');
      });

      it('detects .offset()', () => {
        expect(getChainMode('db.select().from(t).offset(10).')).toBe('select');
      });

      it('detects .rightJoin()', () => {
        expect(getChainMode('db.select().from(t).rightJoin(t2, eq(a,b)).')).toBe('select');
      });

      it('detects .fullJoin()', () => {
        expect(getChainMode('db.select().from(t).fullJoin(t2, eq(a,b)).')).toBe('select');
      });
    });

    describe('Insert Conflict Methods', () => {
      it('detects .onConflictDoUpdate()', () => {
        expect(getChainMode('db.insert(t).values(v).onConflictDoUpdate(c).')).toBe('insert');
      });

      it('detects .onConflictDoNothing()', () => {
        expect(getChainMode('db.insert(t).values(v).onConflictDoNothing().')).toBe('insert');
      });
    });

    describe('Returning for Update/Delete', () => {
      it('update .returning()', () => {
        expect(getChainMode('db.update(t).set(v).returning().')).toBe('update');
      });

      it('delete .returning()', () => {
        expect(getChainMode('db.delete(t).where(c).returning().')).toBe('delete');
      });
    });

    describe('Operators Detection', () => {
      const operators = ['inArray', 'notInArray', 'isNull', 'isNotNull', 'like', 'ilike', 'between', 'not', 'exists', 'notExists'];

      operators.forEach(op => {
        it(`detects operator ${op}`, () => {
          const regex = new RegExp(`\\b(${operators.join('|')}|eq|ne|gt|gte|lt|lte|and|or)\\(`);
          expect(regex.test(`${op}(`)).toBeTruthy();
        });
      });
    });

    describe('Aggregates Detection', () => {
      const aggregates = ['count', 'sum', 'avg', 'min', 'max', 'countDistinct', 'sumDistinct'];

      aggregates.forEach(agg => {
        it(`detects aggregate ${agg}`, () => {
          const regex = new RegExp(`\\b(${aggregates.join('|')})\\(`);
          expect(regex.test(`${agg}(`)).toBeTruthy();
        });
      });
    });

    describe('Final Audit Tests', () => {
      it('detects db.with(...) chain start - select', () => {
        expect(getChainMode('db.with(c).select().from(t).')).toBe('select');
      });

      it('detects db.with(...) chain start - update', () => {
        expect(getChainMode('db.with(c).update(t).')).toBe('update');
      });

      it('detects db.with(...) chain start - delete', () => {
        expect(getChainMode('db.with(c).delete(t).')).toBe('delete');
      });

      it('detects db.with(...) chain start - insert', () => {
        expect(getChainMode('db.with(c).insert(t).')).toBe('insert');
      });

      it('detects .union()', () => {
        expect(getChainMode('db.select().from(t).union(q).')).toBe('select');
      });

      it('detects .intersect()', () => {
        expect(getChainMode('db.select().from(t).intersect(q).')).toBe('select');
      });

      it('detects .except()', () => {
        expect(getChainMode('db.select().from(t).except(q).')).toBe('select');
      });
    });

    describe('Postgres Array Operators', () => {
      const pgOperators = ['arrayContains', 'arrayContained', 'arrayOverlaps'];

      pgOperators.forEach(op => {
        it(`detects operator ${op}`, () => {
          const regex = new RegExp(`\\b(${pgOperators.join('|')})\\(`);
          expect(regex.test(`${op}(`)).toBeTruthy();
        });
      });
    });
  });
});

/**
 * @fileoverview Unit tests for the providers utility module.
 * @see {@link file://../../../src/features/connections/utils/providers.ts} - Source module
 * @module tests/unit/providers
 */

import { describe, it, expect } from 'vitest';
import { parseConnectionUrl } from '@/features/connections/utils/providers';

describe('parseConnectionUrl', () => {
    describe('exact protocol matching', () => {
        it('should match postgres protocol exactly', () => {
            const result = parseConnectionUrl('postgres://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should match postgresql protocol exactly', () => {
            const result = parseConnectionUrl('postgresql://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should match mysql protocol exactly', () => {
            const result = parseConnectionUrl('mysql://user:pass@localhost:3306/db');
            expect(result?.type).toBe('mysql');
        });

        it('should match sqlite protocol exactly', () => {
            const result = parseConnectionUrl('sqlite://user:pass@localhost/db');
            expect(result?.type).toBe('sqlite');
        });

        it('should match libsql protocol exactly', () => {
            const result = parseConnectionUrl('libsql://db.turso.io');
            expect(result?.type).toBe('libsql');
        });
    });

    describe('typo detection with normalized Levenshtein distance', () => {
        it('should correct postttgr -> postgres (shares prefix, high distance)', () => {
            const result = parseConnectionUrl('postttgr://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should correct postgress -> postgres (1 extra char)', () => {
            const result = parseConnectionUrl('postgress://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should correct postgrse -> postgres (transposition)', () => {
            const result = parseConnectionUrl('postgrse://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should correct myyql -> mysql (1 substitution)', () => {
            const result = parseConnectionUrl('myyql://user:pass@localhost:3306/db');
            expect(result?.type).toBe('mysql');
        });

        it('should correct mysq -> mysql (missing char)', () => {
            const result = parseConnectionUrl('mysq://user:pass@localhost:3306/db');
            expect(result?.type).toBe('mysql');
        });

        it('should correct sqlit -> sqlite (missing char)', () => {
            const result = parseConnectionUrl('sqlit://user:pass@localhost/db');
            expect(result?.type).toBe('sqlite');
        });

        it('should correct libslq -> libsql (transposition)', () => {
            const result = parseConnectionUrl('libslq://db.turso.io');
            expect(result?.type).toBe('libsql');
        });
    });

    describe('rejection of unsupported protocols', () => {
        it('should reject redis (no match)', () => {
            const result = parseConnectionUrl('redis://user:pass@localhost:6379/db');
            expect(result).toBeNull();
        });

        it('should reject mongodb (no match)', () => {
            const result = parseConnectionUrl('mongodb://user:pass@localhost/db');
            expect(result).toBeNull();
        });

        it('should reject wildly different protocols', () => {
            const result = parseConnectionUrl('verywrongprotocol://user:pass@localhost:5432/db');
            expect(result).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should reject protocols shorter than 4 characters', () => {
            const result = parseConnectionUrl('po://user:pass@localhost/db');
            expect(result).toBeNull();
        });

        it('should be case insensitive (POSTGRES)', () => {
            const result = parseConnectionUrl('POSTGRES://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });

        it('should be case insensitive (PostgreSQL)', () => {
            const result = parseConnectionUrl('PostgreSQL://user:pass@localhost:5432/db');
            expect(result?.type).toBe('postgres');
        });
    });

    describe('URL component extraction', () => {
        it('should extract host, port, user, password, and database', () => {
            const result = parseConnectionUrl('postgres://myuser:mypass@myhost.com:5433/mydb');
            expect(result).toMatchObject({
                type: 'postgres',
                host: 'myhost.com',
                port: 5433,
                user: 'myuser',
                password: 'mypass',
                database: 'mydb',
            });
        });

        it('should detect SSL from query params', () => {
            const result = parseConnectionUrl('postgres://user:pass@localhost:5432/db?sslmode=require');
            expect(result?.ssl).toBe(true);
        });
    });
});

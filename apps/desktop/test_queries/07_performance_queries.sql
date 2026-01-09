-- Test Query 7: Performance and Optimization
-- This demonstrates performance testing and optimization queries

SELECT 'Performance and Optimization Demo' as section;

-- 1. Query Execution Plan Analysis
SELECT 'EXPLAIN ANALYZE for expensive query:' as info;
EXPLAIN ANALYZE
SELECT 
    u.username,
    COUNT(p.id) as post_count,
    COUNT(c.id) as comment_count,
    MAX(p.created_at) as last_post_date
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
GROUP BY u.id, u.username
HAVING COUNT(p.id) > 0 OR COUNT(c.id) > 0
ORDER BY post_count DESC, comment_count DESC;

-- 2. Index Usage Analysis
SELECT 'Index effectiveness test:' as info;
-- This should use indexes efficiently
SELECT 
    p.id,
    p.title,
    p.status,
    u.username,
    p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.status = 'published'
AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 10;

-- 3. Query Performance Comparison
SELECT 'Testing query performance with different approaches:' as info;

-- Approach 1: Correlated subquery (typically slower)
SELECT 'Approach 1 - Correlated Subquery:' as method;
SELECT 
    u.username,
    (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) as post_count
FROM users u
WHERE u.id IN (1, 2, 3);

-- Approach 2: LEFT JOIN with GROUP BY (typically faster)
SELECT 'Approach 2 - LEFT JOIN + GROUP BY:' as method;
SELECT 
    u.username,
    COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.id IN (1, 2, 3)
GROUP BY u.id, u.username;

-- 4. Bulk Operations Performance
SELECT 'Bulk operation performance test:' as info;

-- Create test data for bulk operations
CREATE TEMPORARY TABLE bulk_test (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    value INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test bulk insert
INSERT INTO bulk_test (name, value)
SELECT 
    'test_' || generate_series,
    generate_series * 10
FROM generate_series(1, 1000);

-- Test bulk update performance
UPDATE bulk_test 
SET value = value * 2 
WHERE id <= 500;

-- Test bulk delete performance
DELETE FROM bulk_test 
WHERE id > 500;

-- Show results
SELECT 'Bulk test results:' as status;
SELECT 
    'Total records created:' as operation,
    MAX(id) as count
FROM bulk_test;

-- Clean up
DROP TABLE bulk_test;

-- 5. Query Optimization with CTEs
WITH OptimizedData AS (
    SELECT 
        u.id as user_id,
        u.username,
        COUNT(DISTINCT p.id) as distinct_posts,
        COUNT(DISTINCT c.id) as distinct_comments,
        COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) as published_posts
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON u.id = c.user_id
    GROUP BY u.id, u.username
    HAVING COUNT(p.id) > 0
)
SELECT 
    username,
    distinct_posts,
    distinct_comments,
    published_posts,
    ROUND(distinct_comments::NUMERIC / NULLIF(distinct_posts, 0), 2) as comments_per_post
FROM OptimizedData
ORDER BY distinct_posts DESC;

-- 6. Index Usage Statistics (PostgreSQL specific)
SELECT 'Checking index usage (PostgreSQL specific):' as info;
-- This query helps understand which indexes are being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 7. Query with hinting for optimization
SELECT 'Optimized query with explicit join order:' as info;
SELECT /*+ LEADING(u p c) */ 
    u.username,
    p.title,
    c.content as comment_text,
    p.created_at as post_date,
    c.created_at as comment_date
FROM users u
JOIN posts p ON u.id = p.user_id AND p.status = 'published'
JOIN comments c ON p.id = c.post_id AND c.is_approved = TRUE
WHERE u.created_at >= CURRENT_TIMESTAMP - INTERVAL '6 months'
ORDER BY p.created_at DESC, c.created_at ASC
LIMIT 20;
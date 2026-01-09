-- Test Query 5: DELETE - Delete operations with caution
-- This demonstrates safe DELETE operations

SELECT 'DELETE Operations Demo' as section;

-- 1. Delete unapproved comments older than 7 days
SELECT 'Deleting old unapproved comments:' as info;
DELETE FROM comments 
WHERE is_approved = FALSE 
AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Show remaining unapproved comments
SELECT 'Remaining unapproved comments:' as status;
SELECT COUNT(*) as unapproved_count 
FROM comments 
WHERE is_approved = FALSE;

-- 2. Delete orphaned data (posts without users)
SELECT 'Deleting orphaned posts (posts without users):' as info;
DELETE FROM posts 
WHERE user_id NOT IN (SELECT id FROM users);

-- Verify no orphaned posts
SELECT 'Orphaned posts count:' as status;
SELECT COUNT(*) as orphaned_posts 
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- 3. Soft delete demonstration using UPDATE (safer approach)
SELECT 'Soft delete: Deactivating inactive users (no recent posts):' as info;
UPDATE users 
SET is_active = FALSE
WHERE id NOT IN (
    SELECT DISTINCT user_id 
    FROM posts 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
);

-- Show active vs inactive users
SELECT 'User status summary:' as status;
SELECT 
    CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status,
    COUNT(*) as user_count
FROM users
GROUP BY is_active;

-- 4. Delete with CASCADE demonstration (using temporary data)
SELECT 'Creating temporary data for cascade delete demo:' as info;
-- Create a temporary table for cascade demo
CREATE TEMPORARY TABLE temp_test_data (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50)
);

-- Insert test data
INSERT INTO temp_test_data (name) VALUES 
('Test Record 1'),
('Test Record 2');

-- Show before delete
SELECT 'Before deletion:' as status;
SELECT * FROM temp_test_data;

-- Delete specific record
DELETE FROM temp_test_data WHERE id = 1;

-- Show after delete
SELECT 'After deletion:' as status;
SELECT * FROM temp_test_data;

-- Clean up temp table
DROP TABLE IF EXISTS temp_test_data;

-- 5. Delete using subquery: Users with no activity
SELECT 'Users with zero activity (no posts, no comments):' as info;
SELECT 
    username,
    email,
    created_at
FROM users 
WHERE id NOT IN (
    SELECT user_id FROM posts 
    UNION 
    SELECT user_id FROM comments
);

-- Safe delete with confirmation count
SELECT 'Count of users to delete (BE CAREFUL):' as warning;
SELECT COUNT(*) as users_to_delete
FROM users 
WHERE id NOT IN (
    SELECT user_id FROM posts 
    UNION 
    SELECT user_id FROM comments
)
AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- Uncomment the following line to actually delete (DANGEROUS!)
-- DELETE FROM users 
-- WHERE id NOT IN (
--     SELECT user_id FROM posts 
--     UNION 
--     SELECT user_id FROM comments
-- )
-- AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- 6. Summary statistics after cleanup operations
SELECT 'Final database statistics:' as section;
SELECT 
    'users' as table_name,
    COUNT(*) as record_count
FROM users
UNION ALL
SELECT 
    'posts' as table_name,
    COUNT(*) as record_count
FROM posts
UNION ALL
SELECT 
    'comments' as table_name,
    COUNT(*) as record_count
FROM comments
UNION ALL
SELECT 
    'categories' as table_name,
    COUNT(*) as record_count
FROM categories
ORDER BY table_name;
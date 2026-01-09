-- Test Query 4: UPDATE - Update operations
-- This demonstrates various UPDATE scenarios

SELECT 'UPDATE Operations Demo' as section;

-- 1. Update user information
SELECT 'Updating user information:' as info;
UPDATE users 
SET 
    last_name = 'Updated',
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'john_doe';

-- Verify the update
SELECT username, email, first_name, last_name, updated_at 
FROM users 
WHERE username = 'john_doe';

-- 2. Update post status (draft to published)
SELECT 'Publishing draft posts:' as info;
UPDATE posts 
SET 
    status = 'published',
    published_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'draft' AND user_id = 1;

-- Verify the updates
SELECT id, title, status, published_at, updated_at 
FROM posts 
WHERE user_id = 1
ORDER BY updated_at DESC;

-- 3. Bulk update: Approve pending comments
SELECT 'Approving pending comments:' as info;
UPDATE comments 
SET 
    is_approved = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE is_approved = FALSE;

-- Show approval results
SELECT 
    c.id,
    c.content,
    u.username as commenter,
    c.is_approved,
    c.updated_at
FROM comments c
JOIN users u ON c.user_id = u.id
ORDER BY c.updated_at DESC;

-- 4. Conditional update: Update post titles with length check
SELECT 'Updating long post titles:' as info;
UPDATE posts 
SET 
    title = SUBSTRING(title, 1, 50) || '...',
    updated_at = CURRENT_TIMESTAMP
WHERE LENGTH(title) > 50;

-- Verify title updates
SELECT id, title, LENGTH(title) as title_length 
FROM posts 
WHERE title LIKE '%...';

-- 5. Update with JOIN: Update user activity based on posts
SELECT 'Marking active users (have published posts):' as info;
UPDATE users 
SET is_active = TRUE
WHERE id IN (
    SELECT DISTINCT user_id 
    FROM posts 
    WHERE status = 'published'
);

-- Show active status
SELECT 
    username,
    is_active,
    (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND status = 'published') as published_posts
FROM users
ORDER BY published_posts DESC, username;

-- 6. Update with calculation: Update user stats (simulated)
SELECT 'User activity summary:' as info;
SELECT 
    u.username,
    u.email,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT c.id) as total_comments,
    CASE 
        WHEN COUNT(DISTINCT p.id) > 2 THEN 'Active Author'
        WHEN COUNT(DISTINCT c.id) > 3 THEN 'Active Commenter'
        ELSE 'Regular User'
    END as activity_level
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
GROUP BY u.id, u.username, u.email
ORDER BY total_posts DESC, total_comments DESC;
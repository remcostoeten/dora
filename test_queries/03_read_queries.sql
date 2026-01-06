-- Test Query 3: READ - Basic SELECT queries
-- This demonstrates various SELECT operations

-- Basic queries
SELECT 'Basic SELECT Queries' as section;

-- 1. Select all users
SELECT 'All Users:' as info;
SELECT id, username, email, first_name, last_name, is_active 
FROM users 
ORDER BY created_at;

-- 2. Select published posts with author information
SELECT 'Published Posts with Authors:' as info;
SELECT 
    p.id,
    p.title,
    u.username as author,
    p.status,
    p.published_at,
    p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.status = 'published'
ORDER BY p.published_at DESC;

-- 3. Count posts by user
SELECT 'Post Count by User:' as info;
SELECT 
    u.username,
    u.email,
    COUNT(p.id) as post_count,
    COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.username, u.email
ORDER BY post_count DESC;

-- 4. Posts with comments count
SELECT 'Posts with Comment Counts:' as info;
SELECT 
    p.id,
    p.title,
    u.username as author,
    COUNT(c.id) as comment_count,
    COUNT(CASE WHEN c.is_approved = TRUE THEN 1 END) as approved_comments
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN comments c ON p.id = c.post_id
GROUP BY p.id, p.title, u.username
ORDER BY comment_count DESC, p.created_at DESC;

-- 5. Advanced query: Users who haven't posted
SELECT 'Users Without Posts:' as info;
SELECT 
    u.username,
    u.email,
    u.created_at as user_since
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE p.id IS NULL
ORDER BY u.created_at;

-- 6. Query with subquery: Recent activity
SELECT 'Recent Activity (last 3 days):' as info;
SELECT 
    'Post' as activity_type,
    p.title as description,
    u.username as user,
    p.created_at as activity_date
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.created_at >= CURRENT_TIMESTAMP - INTERVAL '3 days'

UNION ALL

SELECT 
    'Comment' as activity_type,
    LEFT(c.content, 50) || '...' as description,
    u.username as user,
    c.created_at as activity_date
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.created_at >= CURRENT_TIMESTAMP - INTERVAL '3 days'

ORDER BY activity_date DESC;
-- Test Query 6: Advanced Queries - Window Functions, CTEs, and Complex Joins
-- This demonstrates advanced SQL capabilities

SELECT 'Advanced SQL Queries Demo' as section;

-- 1. Window Functions: Ranking posts by user
WITH RankedPosts AS (
    SELECT 
        p.id,
        p.title,
        p.created_at,
        u.username,
        ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at DESC) as user_rank,
        COUNT(*) OVER (PARTITION BY p.user_id) as total_user_posts
    FROM posts p
    JOIN users u ON p.user_id = u.id
)
SELECT 
    username,
    title,
    user_rank,
    total_user_posts,
    created_at
FROM RankedPosts 
WHERE user_rank <= 2  -- Top 2 posts per user
ORDER BY username, user_rank;

-- 2. CTE with aggregation: User activity summary
WITH UserActivity AS (
    SELECT 
        u.id,
        u.username,
        u.email,
        COUNT(p.id) as post_count,
        COUNT(c.id) as comment_count,
        COALESCE(MAX(p.created_at), u.created_at) as last_activity
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON u.id = c.user_id
    GROUP BY u.id, u.username, u.email
)
SELECT 
    username,
    post_count,
    comment_count,
    post_count + comment_count as total_activity,
    CASE 
        WHEN last_activity > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'Very Active'
        WHEN last_activity > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'Active'
        WHEN last_activity > CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'Moderately Active'
        ELSE 'Inactive'
    END as activity_level,
    last_activity
FROM UserActivity
ORDER BY total_activity DESC, last_activity DESC;

-- 3. Complex JOIN: Posts with categories and full stats
SELECT 
    p.id,
    p.title,
    p.status,
    u.username as author,
    STRING_AGG(cat.name, ', ') as categories,
    COUNT(c.id) as comment_count,
    COUNT(CASE WHEN c.is_approved THEN 1 END) as approved_comments,
    p.created_at,
    p.published_at
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN comments c ON p.id = c.post_id
LEFT JOIN post_categories pc ON p.id = pc.post_id
LEFT JOIN categories cat ON pc.category_id = cat.id
GROUP BY p.id, p.title, p.status, u.username, p.created_at, p.published_at
ORDER BY p.created_at DESC;

-- 4. Recursive CTE: Hierarchical data (simulated category tree)
WITH RECURSIVE CategoryTree AS (
    -- Base case: Root categories (parent_id would be NULL in real schema)
    SELECT 
        id,
        name,
        description,
        0 as level,
        name as path
    FROM categories 
    WHERE id <= 2  -- Simulate root categories
    
    UNION ALL
    
    -- Recursive case: Child categories (simulated)
    SELECT 
        c.id,
        c.name,
        c.description,
        ct.level + 1,
        ct.path || ' > ' || c.name
    FROM categories c
    JOIN CategoryTree ct ON c.id <> ct.id AND ct.level < 2
    WHERE c.id > ct.id AND c.id <= ct.id + 2
)
SELECT 
    level,
    name,
    path,
    description
FROM CategoryTree
ORDER BY path;

-- 5. Pivoting data: User activity by month
WITH MonthlyActivity AS (
    SELECT 
        u.username,
        DATE_TRUNC('month', p.created_at) as activity_month,
        COUNT(p.id) as posts_created,
        COUNT(c.id) as comments_made
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '6 months'
    LEFT JOIN comments c ON u.id = c.user_id AND c.created_at >= CURRENT_TIMESTAMP - INTERVAL '6 months'
    GROUP BY u.id, u.username, DATE_TRUNC('month', p.created_at)
)
SELECT 
    username,
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP - INTERVAL '5 months') THEN posts_created END), 0) as "5_months_ago",
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP - INTERVAL '4 months') THEN posts_created END), 0) as "4_months_ago",
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP - INTERVAL '3 months') THEN posts_created END), 0) as "3_months_ago",
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP - INTERVAL '2 months') THEN posts_created END), 0) as "2_months_ago",
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP - INTERVAL '1 months') THEN posts_created END), 0) as "1_month_ago",
    COALESCE(SUM(CASE WHEN activity_month = DATE_TRUNC('month', CURRENT_TIMESTAMP) THEN posts_created END), 0) as "current_month"
FROM MonthlyActivity
GROUP BY username
HAVING SUM(posts_created) > 0
ORDER BY username;
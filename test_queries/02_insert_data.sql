-- Test Query 2: INSERT - Populate tables with sample data
-- This inserts test data for CRUD operations

-- Insert sample users
INSERT INTO users (username, email, first_name, last_name) VALUES
('john_doe', 'john@example.com', 'John', 'Doe'),
('jane_smith', 'jane@example.com', 'Jane', 'Smith'),
('bob_wilson', 'bob@example.com', 'Bob', 'Wilson'),
('alice_brown', 'alice@example.com', 'Alice', 'Brown'),
('charlie_davis', 'charlie@example.com', 'Charlie', 'Davis')
ON CONFLICT (username) DO NOTHING;

-- Insert sample categories
INSERT INTO categories (name, description) VALUES
('Technology', 'Posts about technology and programming'),
('Lifestyle', 'Lifestyle and personal development posts'),
('Business', 'Business and entrepreneurship content'),
('Science', 'Science and research articles'),
('Travel', 'Travel experiences and guides')
ON CONFLICT (name) DO NOTHING;

-- Insert sample posts
INSERT INTO posts (user_id, title, content, status, published_at) VALUES
(1, 'Getting Started with React', 'React is a popular JavaScript library for building user interfaces...', 'published', CURRENT_TIMESTAMP - INTERVAL '7 days'),
(2, '10 Tips for Better Productivity', 'In this post, I share my top 10 productivity tips...', 'published', CURRENT_TIMESTAMP - INTERVAL '5 days'),
(3, 'Understanding Database Indexes', 'Database indexes are crucial for query performance...', 'draft', NULL),
(1, 'The Future of AI', 'Artificial intelligence is transforming many industries...', 'published', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(4, 'A Guide to Remote Work', 'Remote work has become increasingly popular...', 'published', CURRENT_TIMESTAMP - INTERVAL '1 day'),
(2, 'Introduction to TypeScript', 'TypeScript adds static typing to JavaScript...', 'draft', NULL);

-- Insert sample comments
INSERT INTO comments (post_id, user_id, content, is_approved) VALUES
(1, 3, 'Great article! Very helpful for beginners.', TRUE),
(1, 4, 'Thanks for sharing this. Looking forward to more React content.', TRUE),
(2, 1, 'These productivity tips really work!', TRUE),
(2, 5, 'I would add tip #11: Take regular breaks.', TRUE),
(4, 3, 'AI is definitely changing everything. Exciting times!', TRUE),
(4, 2, 'What about the ethical implications of AI?', FALSE),
(5, 1, 'As a remote worker, I can confirm these points.', TRUE),
(5, 5, 'Remote work has its pros and cons for sure.', TRUE);

-- Link posts to categories (many-to-many relationship)
INSERT INTO post_categories (post_id, category_id) VALUES
(1, 1), -- React post -> Technology
(3, 1), -- Database post -> Technology  
(6, 1), -- TypeScript post -> Technology
(4, 1), -- AI post -> Technology
(2, 2), -- Productivity -> Lifestyle
(5, 2); -- Remote work -> Lifestyle

-- Return summary of inserted data
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM posts) as total_posts,
    (SELECT COUNT(*) FROM comments) as total_comments,
    (SELECT COUNT(*) FROM categories) as total_categories,
    (SELECT COUNT(*) FROM post_categories) as total_post_categories;
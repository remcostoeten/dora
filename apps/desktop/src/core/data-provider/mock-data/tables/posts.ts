import { USERS } from "./users";

const POST_TITLES = [
    "Getting Started with TypeScript in 2024",
    "10 Tips for Better Code Reviews",
    "Introduction to React Server Components",
    "Building Scalable APIs with Node.js",
    "CSS Grid vs Flexbox: When to Use Which",
    "Understanding Docker Containers",
    "The Future of Web Development",
    "Mastering Git Workflow",
    "JavaScript Performance Optimization",
    "Building Accessible Web Applications",
    "Introduction to GraphQL",
    "Testing Best Practices in Frontend",
    "Database Design Fundamentals",
    "CI/CD Pipeline Setup Guide",
    "Microservices Architecture Overview",
    "State Management in React",
    "Security Best Practices for Web Apps",
    "RESTful API Design Principles",
    "Mobile-First Design Approach",
    "Debugging Techniques for Developers",
    "Clean Code Principles",
    "Agile Development Methodology",
    "Cloud Computing Basics",
    "DevOps Culture and Practices",
    "Open Source Contribution Guide",
    "Technical Writing for Developers",
    "Code Documentation Best Practices",
    "Version Control Strategies",
    "Automated Testing Frameworks",
    "Progressive Web Apps Explained",
    "WebSocket Real-time Applications",
    "Authentication and Authorization",
    "Data Structures and Algorithms",
    "Functional Programming Concepts",
    "Object-Oriented Design Patterns",
    "Responsive Design Techniques",
    "Browser Developer Tools Tips",
    "Package Management with npm",
    "Continuous Integration Setup",
    "Deployment Strategies Guide"
];

const STATUSES = ["published", "draft", "archived"];
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): string {
    const date = new Date(Date.now() - Math.random() * daysAgo * 86400000);
    return date.toISOString();
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generatePosts(): Record<string, unknown>[] {
    return POST_TITLES.map(function (title, i) {
        const author = USERS[Math.floor(Math.random() * 8)];
        const status = i < 30 ? "published" : randomFrom(STATUSES);

        return {
            id: i + 1,
            title,
            slug: slugify(title),
            content: LOREM + "\n\n" + LOREM + "\n\n" + LOREM,
            excerpt: LOREM.substring(0, 150) + "...",
            author_id: author.id,
            status,
            published_at: status === "published" ? randomDate(180) : null,
            created_at: randomDate(365),
        };
    });
}

export const POSTS = generatePosts();

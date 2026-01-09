const USERNAMES = ["johndoe", "janedoe", "techwriter", "devguru", "webmaster", "editor_mike", "sarah_cms", "marketing_lead", "content_king", "moderator_1", "author_emma", "guest_writer", "admin_bob", "seo_expert", "copy_editor", "blog_manager", "news_reporter", "feature_writer", "columnist", "reviewer"];
const ROLES = ["admin", "editor", "author", "contributor", "subscriber"];
const BIOS = [
    "Passionate about technology and writing.",
    "Senior developer sharing insights.",
    "Content creator and digital strategist.",
    "Full-stack developer and blogger.",
    "Marketing professional and writer."
];

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): string {
    const date = new Date(Date.now() - Math.random() * daysAgo * 86400000);
    return date.toISOString();
}

function generateUsers(): Record<string, unknown>[] {
    return USERNAMES.map(function (username, i) {
        const roleIndex = i === 0 ? 0 : (i < 3 ? 1 : (i < 8 ? 2 : Math.floor(Math.random() * ROLES.length)));
        return {
            id: i + 1,
            username,
            email: username + "@example.com",
            role: ROLES[roleIndex],
            bio: randomFrom(BIOS),
            avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username,
            created_at: randomDate(500),
        };
    });
}

export const USERS = generateUsers();

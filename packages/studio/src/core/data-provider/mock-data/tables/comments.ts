import { POSTS } from './posts'
import { USERS } from './users'

const COMMENT_BODIES = [
	'Great article! This really helped me understand the topic.',
	'Thanks for sharing this valuable information.',
	'I have a question about the implementation details.',
	'Very well written and easy to follow.',
	'Could you elaborate more on this point?',
	'This is exactly what I was looking for!',
	'Bookmarked for future reference.',
	'Excellent explanation of complex concepts.',
	'I learned something new today, thank you!',
	'Would love to see a follow-up article on this.',
	'The code examples are very helpful.',
	'Clear and concise writing style.',
	'This should be required reading for all developers.',
	'Sharing this with my team!',
	'Perfect timing, I was just working on this.'
]

const GUEST_NAMES = ['Anonymous', 'Guest User', 'Visitor', 'Reader', 'Tech Enthusiast']

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): string {
	const date = new Date(Date.now() - Math.random() * daysAgo * 86400000)
	return date.toISOString()
}

function generateComments(): Record<string, unknown>[] {
	const comments: Record<string, unknown>[] = []
	let commentId = 1

	POSTS.forEach(function (post) {
		if (post.status !== 'published') return

		const numComments = Math.floor(Math.random() * 5)

		for (let i = 0; i < numComments; i++) {
			const isGuest = Math.random() > 0.6
			const user = isGuest ? null : randomFrom(USERS)

			comments.push({
				id: commentId++,
				post_id: post.id,
				user_id: user ? user.id : null,
				author_name: user ? null : randomFrom(GUEST_NAMES),
				body: randomFrom(COMMENT_BODIES),
				approved: Math.random() > 0.1 ? 1 : 0,
				created_at: randomDate(90)
			})
		}
	})

	return comments
}

export const COMMENTS = generateComments()

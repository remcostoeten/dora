const FIRST_NAMES = [
	'Emma',
	'Liam',
	'Olivia',
	'Noah',
	'Ava',
	'Elijah',
	'Sophia',
	'James',
	'Isabella',
	'Oliver',
	'Mia',
	'Benjamin',
	'Charlotte',
	'Lucas',
	'Amelia',
	'Mason',
	'Harper',
	'Ethan',
	'Evelyn',
	'Alexander'
]
const LAST_NAMES = [
	'Smith',
	'Johnson',
	'Williams',
	'Brown',
	'Jones',
	'Garcia',
	'Miller',
	'Davis',
	'Rodriguez',
	'Martinez',
	'Hernandez',
	'Lopez',
	'Gonzalez',
	'Wilson',
	'Anderson',
	'Thomas',
	'Taylor',
	'Moore',
	'Jackson',
	'Martin'
]
const CITIES = [
	'New York',
	'Los Angeles',
	'Chicago',
	'Houston',
	'Phoenix',
	'Philadelphia',
	'San Antonio',
	'San Diego',
	'Dallas',
	'San Jose',
	'Austin',
	'Jacksonville',
	'Fort Worth',
	'Columbus',
	'Charlotte'
]
const COUNTRIES = [
	'USA',
	'Canada',
	'UK',
	'Germany',
	'France',
	'Australia',
	'Netherlands',
	'Sweden',
	'Norway',
	'Denmark'
]

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): string {
	const date = new Date(Date.now() - Math.random() * daysAgo * 86400000)
	return date.toISOString()
}

function generateCustomers(count: number): Record<string, unknown>[] {
	const customers: Record<string, unknown>[] = []

	for (let i = 1; i <= count; i++) {
		const firstName = randomFrom(FIRST_NAMES)
		const lastName = randomFrom(LAST_NAMES)

		customers.push({
			id: i,
			name: firstName + ' ' + lastName,
			email: firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@example.com',
			phone:
				'+1-' +
				Math.floor(100 + Math.random() * 900) +
				'-' +
				Math.floor(100 + Math.random() * 900) +
				'-' +
				Math.floor(1000 + Math.random() * 9000),
			city: randomFrom(CITIES),
			country: randomFrom(COUNTRIES),
			created_at: randomDate(365)
		})
	}

	return customers
}

export const CUSTOMERS = generateCustomers(50)

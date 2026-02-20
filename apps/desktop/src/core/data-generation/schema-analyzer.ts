import { faker } from '@faker-js/faker'

type ColumnType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'timestamp' | 'uuid' | 'json'

export function guessFakerFunction(columnName: string, columnType: string): () => any {
    const name = columnName.toLowerCase()
    const type = columnType.toLowerCase()

    // 1. By exact name match (Highest priority)
    if (name === 'email') return faker.internet.email
    if (name === 'username') return faker.internet.username
    if (name === 'first_name' || name === 'firstname') return faker.person.firstName
    if (name === 'last_name' || name === 'lastname') return faker.person.lastName
    if (name === 'full_name' || name === 'fullname' || name === 'name') return faker.person.fullName
    if (name === 'phone' || name === 'phone_number') return faker.phone.number
    if (name === 'address') return faker.location.streetAddress
    if (name === 'city') return faker.location.city
    if (name === 'zip' || name === 'zipcode' || name === 'postal_code') return faker.location.zipCode
    if (name === 'country') return faker.location.country
    if (name === 'company') return faker.company.name
    if (name === 'description' || name === 'bio') return () => faker.lorem.sentences(2)
    if (name === 'avatar' || name === 'image' || name === 'photo') return faker.image.avatar
    if (name === 'url' || name === 'website') return faker.internet.url
    if (name === 'password') return faker.internet.password

    // 2. By partial name match
    if (name.includes('uuid') || name.includes('id')) return faker.string.uuid
    if (name.includes('email')) return faker.internet.email
    if (name.includes('name')) return faker.person.fullName
    if (name.includes('price') || name.includes('amount') || name.includes('cost')) return () => Number(faker.commerce.price())
    if (name.includes('date') || name.includes('at')) return faker.date.past
    if (name.includes('is_') || name.includes('has_')) return faker.datatype.boolean

    // 3. By Type
    if (type.includes('int')) return () => faker.number.int({ min: 1, max: 1000 })
    if (type.includes('decimal') || type.includes('numeric') || type.includes('float')) return () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
    if (type.includes('bool')) return faker.datatype.boolean
    if (type.includes('date') || type.includes('time')) return faker.date.past
    if (type.includes('uuid')) return faker.string.uuid
    if (type.includes('json')) return () => JSON.stringify({ foo: 'bar', baz: 123 })

    // 4. Fallback
    return faker.lorem.word
}

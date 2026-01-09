import { faker } from '@faker-js/faker';
import { ColumnDefinition, FakerType } from '../types';

const generateValue = (column: ColumnDefinition, locale: string = 'en'): any => {
  const { type, constraints } = column;

  if (Math.random() < (constraints?.nullProbability || 0)) {
    return null;
  }

  if (constraints?.defaultValue !== undefined && Math.random() < 0.1) {
    return constraints.defaultValue;
  }

  switch (type) {
    case 'firstName':
      return faker.person.firstName();
    case 'lastName':
      return faker.person.lastName();
    case 'fullName':
      return faker.person.fullName();
    case 'email':
      return faker.internet.email();
    case 'username':
      return faker.internet.userName();
    case 'password':
      return faker.internet.password();
    case 'sentence':
      return faker.lorem.sentence();
    case 'paragraph':
      return faker.lorem.paragraph();
    case 'word':
      return faker.lorem.word();
    case 'slug':
      return faker.lorem.slug();
    case 'integer':
      return faker.number.int({ min: constraints?.min || 0, max: constraints?.max || 1000 });
    case 'float':
      return faker.number.float({ min: constraints?.min || 0, max: constraints?.max || 1000, precision: 0.01 });
    case 'price':
      return parseFloat(faker.commerce.price({ min: constraints?.min || 1, max: constraints?.max || 1000, dec: 2 }));
    case 'percentage':
      return faker.number.float({ min: 0, max: 100, precision: 0.01 });
    case 'date':
      return faker.date.recent().toISOString().split('T')[0];
    case 'futureDate':
      return faker.date.future().toISOString().split('T')[0];
    case 'pastDate':
      return faker.date.past().toISOString().split('T')[0];
    case 'recentDate':
      return faker.date.recent().toISOString().split('T')[0];
    case 'timestamp':
      return faker.date.recent().toISOString();
    case 'url':
      return faker.internet.url();
    case 'domainName':
      return faker.internet.domainName();
    case 'ipAddress':
      return faker.internet.ip();
    case 'userAgent':
      return faker.internet.userAgent();
    case 'uuid':
      return faker.string.uuid();
    case 'phoneNumber':
      return faker.phone.number();
    case 'streetAddress':
      return faker.location.streetAddress();
    case 'city':
      return faker.location.city();
    case 'country':
      return faker.location.country();
    case 'zipCode':
      return faker.location.zipCode();
    case 'state':
      return faker.location.state();
    case 'latitude':
      return faker.location.latitude();
    case 'longitude':
      return faker.location.longitude();
    case 'companyName':
      return faker.company.name();
    case 'jobTitle':
      return faker.person.jobTitle();
    case 'department':
      return faker.commerce.department();
    case 'productName':
      return faker.commerce.productName();
    case 'productDescription':
      return faker.commerce.productDescription();
    case 'category':
      return faker.commerce.department();
    case 'imageUrl':
      return faker.image.url();
    case 'avatarUrl':
      return faker.image.avatar();
    case 'boolean':
      return faker.datatype.boolean();
    case 'json':
      return JSON.stringify({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        value: faker.number.int(100)
      });
    case 'literal':
      return constraints?.defaultValue || null;
    case 'range':
      return faker.number.int({ min: constraints?.min || 0, max: constraints?.max || 100 });
    default:
      return null;
  }
};

export { generateValue };
export default { generateValue };
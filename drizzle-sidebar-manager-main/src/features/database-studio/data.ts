import { ColumnDefinition, TableData } from "./types";

// Column definitions for each table
export const TABLE_COLUMNS: Record<string, ColumnDefinition[]> = {
    categories: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "name", type: "varchar(15)", nullable: false, primaryKey: false },
        { name: "description", type: "text", nullable: true, primaryKey: false },
    ],
    customers: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "company_name", type: "varchar(40)", nullable: false, primaryKey: false },
        { name: "contact_name", type: "varchar(30)", nullable: true, primaryKey: false },
        { name: "contact_title", type: "varchar(30)", nullable: true, primaryKey: false },
        { name: "city", type: "varchar(15)", nullable: true, primaryKey: false },
        { name: "country", type: "varchar(15)", nullable: true, primaryKey: false },
        { name: "phone", type: "varchar(24)", nullable: true, primaryKey: false },
    ],
    employees: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "first_name", type: "varchar(10)", nullable: false, primaryKey: false },
        { name: "last_name", type: "varchar(20)", nullable: false, primaryKey: false },
        { name: "title", type: "varchar(30)", nullable: true, primaryKey: false },
        { name: "hire_date", type: "timestamp", nullable: true, primaryKey: false },
        { name: "city", type: "varchar(15)", nullable: true, primaryKey: false },
    ],
    orders: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "customer_id", type: "integer", nullable: false, primaryKey: false },
        { name: "employee_id", type: "integer", nullable: true, primaryKey: false },
        { name: "order_date", type: "timestamp", nullable: true, primaryKey: false },
        { name: "shipped_date", type: "timestamp", nullable: true, primaryKey: false },
        { name: "freight", type: "decimal(10,2)", nullable: true, primaryKey: false },
    ],
    products: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "name", type: "varchar(40)", nullable: false, primaryKey: false },
        { name: "supplier_id", type: "integer", nullable: true, primaryKey: false },
        { name: "category_id", type: "integer", nullable: true, primaryKey: false },
        { name: "unit_price", type: "decimal(10,2)", nullable: true, primaryKey: false },
        { name: "units_in_stock", type: "smallint", nullable: true, primaryKey: false },
        { name: "discontinued", type: "boolean", nullable: false, primaryKey: false },
    ],
    suppliers: [
        { name: "id", type: "integer", nullable: false, primaryKey: true },
        { name: "company_name", type: "varchar(40)", nullable: false, primaryKey: false },
        { name: "contact_name", type: "varchar(30)", nullable: true, primaryKey: false },
        { name: "city", type: "varchar(15)", nullable: true, primaryKey: false },
        { name: "country", type: "varchar(15)", nullable: true, primaryKey: false },
        { name: "phone", type: "varchar(24)", nullable: true, primaryKey: false },
    ],
};

// Mock row data for each table
export const TABLE_DATA: Record<string, Record<string, unknown>[]> = {
    categories: [
        { id: 1, name: "Beverages", description: "Soft drinks, coffees, teas, beers, and ales" },
        { id: 2, name: "Condiments", description: "Sweet and savory sauces, relishes, spreads" },
        { id: 3, name: "Confections", description: "Desserts, candies, and sweet breads" },
        { id: 4, name: "Dairy Products", description: "Cheeses and dairy products" },
        { id: 5, name: "Grains/Cereals", description: "Breads, crackers, pasta, and cereal" },
        { id: 6, name: "Meat/Poultry", description: "Prepared meats and poultry" },
        { id: 7, name: "Produce", description: "Dried fruit and bean curd" },
        { id: 8, name: "Seafood", description: "Seaweed and fish" },
    ],
    customers: [
        { id: 1, company_name: "Alfreds Futterkiste", contact_name: "Maria Anders", contact_title: "Sales Rep", city: "Berlin", country: "Germany", phone: "030-0074321" },
        { id: 2, company_name: "Ana Trujillo Emparedados", contact_name: "Ana Trujillo", contact_title: "Owner", city: "México D.F.", country: "Mexico", phone: "(5) 555-4729" },
        { id: 3, company_name: "Antonio Moreno Taquería", contact_name: "Antonio Moreno", contact_title: "Owner", city: "México D.F.", country: "Mexico", phone: "(5) 555-3932" },
        { id: 4, company_name: "Around the Horn", contact_name: "Thomas Hardy", contact_title: "Sales Rep", city: "London", country: "UK", phone: "(171) 555-7788" },
        { id: 5, company_name: "Berglunds snabbköp", contact_name: "Christina Berglund", contact_title: "Order Admin", city: "Luleå", country: "Sweden", phone: "0921-12 34 65" },
        { id: 6, company_name: "Blauer See Delikatessen", contact_name: "Hanna Moos", contact_title: "Sales Rep", city: "Mannheim", country: "Germany", phone: "0621-08460" },
        { id: 7, company_name: "Blondesddsl père et fils", contact_name: "Frédérique Citeaux", contact_title: "Marketing Mgr", city: "Strasbourg", country: "France", phone: "88.60.15.31" },
        { id: 8, company_name: "Bólido Comidas preparadas", contact_name: "Martín Sommer", contact_title: "Owner", city: "Madrid", country: "Spain", phone: "(91) 555 22 82" },
    ],
    employees: [
        { id: 1, first_name: "Nancy", last_name: "Davolio", title: "Sales Representative", hire_date: "1992-05-01", city: "Seattle" },
        { id: 2, first_name: "Andrew", last_name: "Fuller", title: "Vice President, Sales", hire_date: "1992-08-14", city: "Tacoma" },
        { id: 3, first_name: "Janet", last_name: "Leverling", title: "Sales Representative", hire_date: "1992-04-01", city: "Kirkland" },
        { id: 4, first_name: "Margaret", last_name: "Peacock", title: "Sales Representative", hire_date: "1993-05-03", city: "Redmond" },
        { id: 5, first_name: "Steven", last_name: "Buchanan", title: "Sales Manager", hire_date: "1993-10-17", city: "London" },
    ],
    orders: [
        { id: 10248, customer_id: 1, employee_id: 5, order_date: "2024-01-15", shipped_date: "2024-01-18", freight: 32.38 },
        { id: 10249, customer_id: 2, employee_id: 6, order_date: "2024-01-16", shipped_date: "2024-01-20", freight: 11.61 },
        { id: 10250, customer_id: 3, employee_id: 4, order_date: "2024-01-17", shipped_date: "2024-01-22", freight: 65.83 },
        { id: 10251, customer_id: 4, employee_id: 3, order_date: "2024-01-18", shipped_date: null, freight: 41.34 },
        { id: 10252, customer_id: 5, employee_id: 4, order_date: "2024-01-19", shipped_date: "2024-01-23", freight: 51.30 },
        { id: 10253, customer_id: 6, employee_id: 3, order_date: "2024-01-20", shipped_date: "2024-01-24", freight: 58.17 },
    ],
    products: [
        { id: 1, name: "Chai", supplier_id: 1, category_id: 1, unit_price: 18.00, units_in_stock: 39, discontinued: false },
        { id: 2, name: "Chang", supplier_id: 1, category_id: 1, unit_price: 19.00, units_in_stock: 17, discontinued: false },
        { id: 3, name: "Aniseed Syrup", supplier_id: 1, category_id: 2, unit_price: 10.00, units_in_stock: 13, discontinued: false },
        { id: 4, name: "Chef Anton's Cajun Seasoning", supplier_id: 2, category_id: 2, unit_price: 22.00, units_in_stock: 53, discontinued: false },
        { id: 5, name: "Chef Anton's Gumbo Mix", supplier_id: 2, category_id: 2, unit_price: 21.35, units_in_stock: 0, discontinued: true },
        { id: 6, name: "Grandma's Boysenberry Spread", supplier_id: 3, category_id: 2, unit_price: 25.00, units_in_stock: 120, discontinued: false },
        { id: 7, name: "Uncle Bob's Organic Dried Pears", supplier_id: 3, category_id: 7, unit_price: 30.00, units_in_stock: 15, discontinued: false },
    ],
    suppliers: [
        { id: 1, company_name: "Exotic Liquids", contact_name: "Charlotte Cooper", city: "London", country: "UK", phone: "(171) 555-2222" },
        { id: 2, company_name: "New Orleans Cajun Delights", contact_name: "Shelley Burke", city: "New Orleans", country: "USA", phone: "(100) 555-4822" },
        { id: 3, company_name: "Grandma Kelly's Homestead", contact_name: "Regina Murphy", city: "Ann Arbor", country: "USA", phone: "(313) 555-5735" },
        { id: 4, company_name: "Tokyo Traders", contact_name: "Yoshi Nagase", city: "Tokyo", country: "Japan", phone: "(03) 3555-5011" },
    ],
};

// Function to get table data with sort, filter, and pagination
export async function getTableData(
    params: {
        tableId: string;
        limit?: number;
        offset?: number;
        sort?: { column: string; direction: "asc" | "desc" };
        filters?: { column: string; operator: string; value: unknown }[];
    }
): Promise<TableData> {
    const { tableId, limit = 50, offset = 0, sort, filters } = params;

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    const columns = TABLE_COLUMNS[tableId] || [];
    let rows = [...(TABLE_DATA[tableId] || [])];

    // 1. Filter
    if (filters && filters.length > 0) {
        rows = rows.filter((row) => {
            return filters.every((filter) => {
                const cellValue = row[filter.column];
                const filterValue = filter.value;

                switch (filter.operator) {
                    case "eq":
                        return String(cellValue) === String(filterValue);
                    case "neq":
                        return String(cellValue) !== String(filterValue);
                    case "gt":
                        return (cellValue as number) > (filterValue as number);
                    case "gte":
                        return (cellValue as number) >= (filterValue as number);
                    case "lt":
                        return (cellValue as number) < (filterValue as number);
                    case "lte":
                        return (cellValue as number) <= (filterValue as number);
                    case "ilike":
                        return String(cellValue)
                            .toLowerCase()
                            .includes(String(filterValue).toLowerCase());
                    case "contains":
                        return String(cellValue).includes(String(filterValue));
                    default:
                        return true;
                }
            });
        });
    }

    // 2. Sort
    if (sort) {
        rows.sort((a, b) => {
            const valA = a[sort.column] as string | number;
            const valB = b[sort.column] as string | number;

            if (valA < valB) return sort.direction === "asc" ? -1 : 1;
            if (valA > valB) return sort.direction === "asc" ? 1 : -1;
            return 0;
        });
    }

    const totalCount = rows.length;
    const paginatedRows = rows.slice(offset, offset + limit);

    return {
        columns,
        rows: paginatedRows,
        totalCount,
        executionTime: Math.floor(50 + Math.random() * 100),
    };
}

// Get all available table IDs
export function getAvailableTableIds(): string[] {
    return Object.keys(TABLE_COLUMNS);
}

import type { TableInfo, ColumnInfo, TableRow } from "../types";

export const MOCK_TABLES: TableInfo[] = [
  { name: "account", rowCount: 0, type: "table" },
  { name: "analytics_zero_session", rowCount: 0, type: "table" },
  { name: "entry", rowCount: 0, type: "table" },
  { name: "feature_flag", rowCount: 0, type: "table" },
  { name: "session", rowCount: 0, type: "table" },
  { name: "shared_message", rowCount: 0, type: "table" },
  { name: "user", rowCount: 0, type: "table" },
  { name: "user_feature_flag", rowCount: 0, type: "table" },
  { name: "verification", rowCount: 0, type: "table" },
  { name: "customers", rowCount: 50, type: "table" },
];

export const MOCK_COLUMNS: Record<string, ColumnInfo[]> = {
  account: [
    { name: "id", dataType: "text", isPrimaryKey: true },
    { name: "account_id", dataType: "text" },
    { name: "provider_id", dataType: "text" },
    { name: "user_id", dataType: "text" },
    { name: "access_token", dataType: "text" },
    { name: "refresh_token", dataType: "text" },
    { name: "id_token", dataType: "text" },
    { name: "access_token_expires_at", dataType: "timestamp" },
    { name: "refresh_token_expires_at", dataType: "timestamp" },
    { name: "scope", dataType: "text" },
  ],
  customers: [
    { name: "id", dataType: "char(5)", isPrimaryKey: true },
    { name: "company_name", dataType: "varchar(40)" },
    { name: "contact_name", dataType: "varchar(30)" },
    { name: "contact_title", dataType: "varchar(30)" },
    { name: "address", dataType: "varchar(60)" },
    { name: "city", dataType: "varchar(15)" },
    { name: "region", dataType: "varchar(15)" },
    { name: "postal_code", dataType: "varchar(10)" },
    { name: "country", dataType: "varchar(15)" },
    { name: "phone", dataType: "varchar(24)" },
  ],
};

export const MOCK_CUSTOMER_DATA: TableRow[] = [
  { id: "ALFKI", company_name: "Alfreds Futterkiste", contact_name: "Maria Anders", contact_title: "Sales Representative", address: "Obere Str. 57", city: "Berlin", region: null, postal_code: "12209", country: "Germany", phone: "030-0074321" },
  { id: "ANATR", company_name: "Ana Trujillo Emparedado...", contact_name: "Ana Trujillo", contact_title: "Owner", address: "Avda. de la Constitución...", city: "México D.F.", region: null, postal_code: "05021", country: "Mexico", phone: "(5) 555-4729" },
  { id: "ANTON", company_name: "Antonio Moreno Taquería", contact_name: "Antonio Moreno", contact_title: "Owner", address: "Mataderos 2312", city: "México D.F.", region: null, postal_code: "05023", country: "Mexico", phone: "(5) 555-3932" },
  { id: "AROUT", company_name: "Around the Horn", contact_name: "Thomas Hardy", contact_title: "Sales Representative", address: "120 Hanover Sq.", city: "London", region: null, postal_code: "WA1 1DP", country: "UK", phone: "(171) 555-7788" },
  { id: "BERGS", company_name: "Berglunds snabbköp", contact_name: "Christina Berglund", contact_title: "Order Administrator", address: "Berguvsvägen 8", city: "Luleå", region: null, postal_code: "S-958 22", country: "Sweden", phone: "0921-12 34 65" },
  { id: "BLAUS", company_name: "Blauer See Delikatessen", contact_name: "Hanna Moos", contact_title: "Sales Representative", address: "Forsterstr. 57", city: "Mannheim", region: null, postal_code: "68306", country: "Germany", phone: "0621-08460" },
  { id: "BLONP", company_name: "Blondesdsl père et fi...", contact_name: "Frédérique Citeaux", contact_title: "Marketing Manager", address: "24, place Kléber", city: "Strasbourg", region: null, postal_code: "67000", country: "France", phone: "88.60.15.31" },
  { id: "BOLID", company_name: "Bólido Comidas prepara...", contact_name: "Martín Sommer", contact_title: "Owner", address: "C/ Araquil, 67", city: "Madrid", region: null, postal_code: "28023", country: "Spain", phone: "(91) 555 22 82" },
  { id: "BONAP", company_name: "Bon app'", contact_name: "Laurence Lebihan", contact_title: "Owner", address: "12, rue des Bouchers", city: "Marseille", region: null, postal_code: "13008", country: "France", phone: "91.24.45.40" },
  { id: "BOTTM", company_name: "Bottom-Dollar Markets", contact_name: "Elizabeth Lincoln", contact_title: "Accounting Manager", address: "23 Tsawassen Blvd.", city: "Tsawassen", region: "BC", postal_code: "T2F 8M4", country: "Canada", phone: "(604) 555-4729" },
  { id: "BSBEV", company_name: "B's Beverages", contact_name: "Victoria Ashworth", contact_title: "Sales Representative", address: "Fauntleroy Circus", city: "London", region: null, postal_code: "EC2 5NT", country: "UK", phone: "(171) 555-1212" },
  { id: "CACTU", company_name: "Cactus Comidas para ll...", contact_name: "Patricio Simpson", contact_title: "Sales Agent", address: "Cerrito 333", city: "Buenos Aires", region: null, postal_code: "1010", country: "Argentina", phone: "(1) 135-5555" },
  { id: "CENTC", company_name: "Centro comercial Mocte...", contact_name: "Francisco Chang", contact_title: "Marketing Manager", address: "Sierras de Granada 9993", city: "México D.F.", region: null, postal_code: "05022", country: "Mexico", phone: "(5) 555-3392" },
  { id: "CHOPS", company_name: "Chop-suey Chinese", contact_name: "Yang Wang", contact_title: "Owner", address: "Hauptstr. 29", city: "Bern", region: null, postal_code: "3012", country: "Switzerland", phone: "0452-076545" },
  { id: "COMMI", company_name: "Comércio Mineiro", contact_name: "Pedro Afonso", contact_title: "Sales Associate", address: "Av. dos Lusíadas, 23", city: "Sao Paulo", region: "SP", postal_code: "05432-043", country: "Brazil", phone: "(11) 555-7647" },
];

export function getColumnsForTable(tableName: string): ColumnInfo[] {
  return MOCK_COLUMNS[tableName] || MOCK_COLUMNS.account;
}

export function getDataForTable(tableName: string): TableRow[] {
  if (tableName === "customers") {
    return MOCK_CUSTOMER_DATA;
  }
  return [];
}

import {
  float8Column,
  int4Column,
  textColumn,
  timestamptzColumn,
} from '@prisma-next/adapter-postgres/column-types';
import sqlFamily from '@prisma-next/family-sql/pack';
import { defineContract, field, model } from '@prisma-next/sql-contract-ts/contract-builder';
import postgresPack from '@prisma-next/target-postgres/pack';

const Customer = model('Customer', {
  fields: {
    id: field.column(int4Column).id(),
    companyName: field.column(textColumn).column('company_name'),
    contactName: field.column(textColumn).column('contact_name'),
    contactTitle: field.column(textColumn).column('contact_title'),
    address: field.column(textColumn),
    city: field.column(textColumn),
    postalCode: field.column(textColumn).optional().column('postal_code'),
    region: field.column(textColumn).optional(),
    country: field.column(textColumn),
    phone: field.column(textColumn),
    fax: field.column(textColumn).optional(),
  },
}).sql({ table: 'customers' });

const Employee = model('Employee', {
  fields: {
    id: field.column(int4Column).id(),
    lastName: field.column(textColumn).column('last_name'),
    firstName: field.column(textColumn).optional().column('first_name'),
    title: field.column(textColumn),
    titleOfCourtesy: field.column(textColumn).column('title_of_courtesy'),
    birthDate: field.column(timestamptzColumn).column('birth_date'),
    hireDate: field.column(timestamptzColumn).column('hire_date'),
    address: field.column(textColumn),
    city: field.column(textColumn),
    postalCode: field.column(textColumn).column('postal_code'),
    country: field.column(textColumn),
    homePhone: field.column(textColumn).column('home_phone'),
    extension: field.column(int4Column),
    notes: field.column(textColumn),
    recipientId: field.column(int4Column).optional().column('recipient_id'),
  },
}).sql(({ cols, constraints }) => ({
  table: 'employees',
  // Self-referential FK: forward-reference the model by name via `constraints.ref`
  // to avoid the `const Employee = ... Employee.refs.id ...` circular type that
  // TS cannot resolve in the initializer.
  foreignKeys: [constraints.foreignKey(cols.recipientId, constraints.ref('Employee', 'id'))],
}));

const Order = model('Order', {
  fields: {
    id: field.column(int4Column).id(),
    orderDate: field.column(timestamptzColumn).column('order_date'),
    requiredDate: field.column(timestamptzColumn).column('required_date'),
    shippedDate: field.column(timestamptzColumn).optional().column('shipped_date'),
    shipVia: field.column(int4Column).column('ship_via'),
    freight: field.column(float8Column),
    shipName: field.column(textColumn).column('ship_name'),
    shipCity: field.column(textColumn).column('ship_city'),
    shipRegion: field.column(textColumn).optional().column('ship_region'),
    shipPostalCode: field.column(textColumn).optional().column('ship_postal_code'),
    shipCountry: field.column(textColumn).column('ship_country'),
    customerId: field.column(int4Column).column('customer_id'),
    employeeId: field.column(int4Column).column('employee_id'),
  },
}).sql(({ cols, constraints }) => ({
  table: 'orders',
  foreignKeys: [
    constraints.foreignKey(cols.customerId, Customer.refs.id),
    constraints.foreignKey(cols.employeeId, Employee.refs.id),
  ],
}));

const Supplier = model('Supplier', {
  fields: {
    id: field.column(int4Column).id(),
    companyName: field.column(textColumn).column('company_name'),
    contactName: field.column(textColumn).column('contact_name'),
    contactTitle: field.column(textColumn).column('contact_title'),
    address: field.column(textColumn),
    city: field.column(textColumn),
    region: field.column(textColumn).optional(),
    postalCode: field.column(textColumn).column('postal_code'),
    country: field.column(textColumn),
    phone: field.column(textColumn),
  },
}).sql({ table: 'suppliers' });

const Product = model('Product', {
  fields: {
    id: field.column(int4Column).id(),
    name: field.column(textColumn),
    quantityPerUnit: field.column(textColumn).column('qt_per_unit'),
    unitPrice: field.column(float8Column).column('unit_price'),
    unitsInStock: field.column(int4Column).column('units_in_stock'),
    unitsOnOrder: field.column(int4Column).column('units_on_order'),
    reorderLevel: field.column(int4Column).column('reorder_level'),
    discontinued: field.column(int4Column),
    supplierId: field.column(int4Column).column('supplier_id'),
  },
}).sql(({ cols, constraints }) => ({
  table: 'products',
  foreignKeys: [constraints.foreignKey(cols.supplierId, Supplier.refs.id)],
}));

const Detail = model('Detail', {
  fields: {
    unitPrice: field.column(float8Column).column('unit_price'),
    quantity: field.column(int4Column),
    discount: field.column(float8Column),
    orderId: field.column(int4Column).column('order_id'),
    productId: field.column(int4Column).column('product_id'),
  },
})
  .attributes(({ fields, constraints }) => ({
    id: constraints.id([fields.orderId, fields.productId]),
  }))
  .sql(({ cols, constraints }) => ({
    table: 'order_details',
    foreignKeys: [
      constraints.foreignKey(cols.orderId, Order.refs.id),
      constraints.foreignKey(cols.productId, Product.refs.id),
    ],
  }));

export const contract = defineContract({
  family: sqlFamily,
  target: postgresPack,
  models: {
    Customer,
    Employee,
    Order,
    Detail,
    Product,
    Supplier,
  },
});

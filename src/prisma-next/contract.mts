import type { CodecTypes } from "@prisma-next/adapter-postgres/codec-types";
import {
  float8Column,
  int4Column,
  textColumn,
} from "@prisma-next/adapter-postgres/column-types";
import { defineContract } from "@prisma-next/sql-contract-ts/contract-builder";
import postgresPack from "@prisma-next/target-postgres/pack";

const varcharColumnUnbounded = {
  codecId: "pg/varchar@1",
  nativeType: "character varying",
};

const dateColumn = {
  codecId: "pg/text@1",
  nativeType: "date",
};

export const contract = defineContract<CodecTypes>()
  .target(postgresPack)
  .foreignKeyDefaults({ constraint: true, index: false })
  .table("customers", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("company_name", { type: textColumn, nullable: false })
      .column("contact_name", { type: varcharColumnUnbounded, nullable: false })
      .column("contact_title", { type: varcharColumnUnbounded, nullable: false })
      .column("address", { type: varcharColumnUnbounded, nullable: false })
      .column("city", { type: varcharColumnUnbounded, nullable: false })
      .column("postal_code", { type: varcharColumnUnbounded, nullable: true })
      .column("region", { type: varcharColumnUnbounded, nullable: true })
      .column("country", { type: varcharColumnUnbounded, nullable: false })
      .column("phone", { type: varcharColumnUnbounded, nullable: false })
      .column("fax", { type: varcharColumnUnbounded, nullable: true })
      .primaryKey(["id"]),
  )
  .table("employees", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("last_name", { type: varcharColumnUnbounded, nullable: false })
      .column("first_name", { type: varcharColumnUnbounded, nullable: true })
      .column("title", { type: varcharColumnUnbounded, nullable: false })
      .column("title_of_courtesy", { type: varcharColumnUnbounded, nullable: false })
      .column("birth_date", { type: dateColumn, nullable: false })
      .column("hire_date", { type: dateColumn, nullable: false })
      .column("address", { type: varcharColumnUnbounded, nullable: false })
      .column("city", { type: varcharColumnUnbounded, nullable: false })
      .column("postal_code", { type: varcharColumnUnbounded, nullable: false })
      .column("country", { type: varcharColumnUnbounded, nullable: false })
      .column("home_phone", { type: varcharColumnUnbounded, nullable: false })
      .column("extension", { type: int4Column, nullable: false })
      .column("notes", { type: textColumn, nullable: false })
      .column("recipient_id", { type: int4Column, nullable: true })
      .primaryKey(["id"])
      .foreignKey(
        ["recipient_id"],
        { table: "employees", columns: ["id"] },
        { name: "employees_recipient_id_employees_id_fk" },
      )
      .index(["recipient_id"], "recepient_idx"),
  )
  .table("orders", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("order_date", { type: dateColumn, nullable: false })
      .column("required_date", { type: dateColumn, nullable: false })
      .column("shipped_date", { type: dateColumn, nullable: true })
      .column("ship_via", { type: int4Column, nullable: false })
      .column("freight", { type: float8Column, nullable: false })
      .column("ship_name", { type: varcharColumnUnbounded, nullable: false })
      .column("ship_city", { type: varcharColumnUnbounded, nullable: false })
      .column("ship_region", { type: varcharColumnUnbounded, nullable: true })
      .column("ship_postal_code", { type: varcharColumnUnbounded, nullable: true })
      .column("ship_country", { type: varcharColumnUnbounded, nullable: false })
      .column("customer_id", { type: int4Column, nullable: false })
      .column("employee_id", { type: int4Column, nullable: false })
      .primaryKey(["id"])
      .foreignKey(
        ["customer_id"],
        { table: "customers", columns: ["id"] },
        { name: "orders_customer_id_customers_id_fk" },
      )
      .foreignKey(
        ["employee_id"],
        { table: "employees", columns: ["id"] },
        { name: "orders_employee_id_employees_id_fk" },
      ),
  )
  .table("suppliers", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("company_name", { type: varcharColumnUnbounded, nullable: false })
      .column("contact_name", { type: varcharColumnUnbounded, nullable: false })
      .column("contact_title", { type: varcharColumnUnbounded, nullable: false })
      .column("address", { type: varcharColumnUnbounded, nullable: false })
      .column("city", { type: varcharColumnUnbounded, nullable: false })
      .column("region", { type: varcharColumnUnbounded, nullable: true })
      .column("postal_code", { type: varcharColumnUnbounded, nullable: false })
      .column("country", { type: varcharColumnUnbounded, nullable: false })
      .column("phone", { type: varcharColumnUnbounded, nullable: false })
      .primaryKey(["id"]),
  )
  .table("products", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("name", { type: textColumn, nullable: false })
      .column("qt_per_unit", { type: varcharColumnUnbounded, nullable: false })
      .column("unit_price", { type: float8Column, nullable: false })
      .column("units_in_stock", { type: int4Column, nullable: false })
      .column("units_on_order", { type: int4Column, nullable: false })
      .column("reorder_level", { type: int4Column, nullable: false })
      .column("discontinued", { type: int4Column, nullable: false })
      .column("supplier_id", { type: int4Column, nullable: false })
      .primaryKey(["id"])
      .foreignKey(
        ["supplier_id"],
        { table: "suppliers", columns: ["id"] },
        { name: "products_supplier_id_suppliers_id_fk" },
      )
      .index(["supplier_id"], "supplier_idx"),
  )
  .table("order_details", (t) =>
    t
      .column("unit_price", { type: float8Column, nullable: false })
      .column("quantity", { type: int4Column, nullable: false })
      .column("discount", { type: float8Column, nullable: false })
      .column("order_id", { type: int4Column, nullable: false })
      .column("product_id", { type: int4Column, nullable: false })
      .primaryKey(["order_id", "product_id"])
      .foreignKey(
        ["order_id"],
        { table: "orders", columns: ["id"] },
        { name: "order_details_order_id_orders_id_fk" },
      )
      .foreignKey(
        ["product_id"],
        { table: "products", columns: ["id"] },
        { name: "order_details_product_id_products_id_fk" },
      )
      .index(["order_id"], "order_id_idx")
      .index(["product_id"], "product_id_idx"),
  )
  .model("Customer", "customers", (m) =>
    m
      .field("id", "id")
      .field("companyName", "company_name")
      .field("contactName", "contact_name")
      .field("contactTitle", "contact_title")
      .field("address", "address")
      .field("city", "city")
      .field("postalCode", "postal_code")
      .field("region", "region")
      .field("country", "country")
      .field("phone", "phone")
      .field("fax", "fax")
      .relation("orders", {
        toModel: "Order",
        toTable: "orders",
        cardinality: "1:N",
        on: {
          parentTable: "customers",
          parentColumns: ["id"],
          childTable: "orders",
          childColumns: ["customer_id"],
        },
      }),
  )
  .model("Employee", "employees", (m) =>
    m
      .field("id", "id")
      .field("lastName", "last_name")
      .field("firstName", "first_name")
      .field("title", "title")
      .field("titleOfCourtesy", "title_of_courtesy")
      .field("birthDate", "birth_date")
      .field("hireDate", "hire_date")
      .field("address", "address")
      .field("city", "city")
      .field("postalCode", "postal_code")
      .field("country", "country")
      .field("homePhone", "home_phone")
      .field("extension", "extension")
      .field("notes", "notes")
      .field("recipientId", "recipient_id")
      .relation("recipient", {
        toModel: "Employee",
        toTable: "employees",
        cardinality: "N:1",
        on: {
          parentTable: "employees",
          parentColumns: ["recipient_id"],
          childTable: "employees",
          childColumns: ["id"],
        },
      })
      .relation("reporters", {
        toModel: "Employee",
        toTable: "employees",
        cardinality: "1:N",
        on: {
          parentTable: "employees",
          parentColumns: ["id"],
          childTable: "employees",
          childColumns: ["recipient_id"],
        },
      })
      .relation("orders", {
        toModel: "Order",
        toTable: "orders",
        cardinality: "1:N",
        on: {
          parentTable: "employees",
          parentColumns: ["id"],
          childTable: "orders",
          childColumns: ["employee_id"],
        },
      }),
  )
  .model("Order", "orders", (m) =>
    m
      .field("id", "id")
      .field("orderDate", "order_date")
      .field("requiredDate", "required_date")
      .field("shippedDate", "shipped_date")
      .field("shipVia", "ship_via")
      .field("freight", "freight")
      .field("shipName", "ship_name")
      .field("shipCity", "ship_city")
      .field("shipRegion", "ship_region")
      .field("shipPostalCode", "ship_postal_code")
      .field("shipCountry", "ship_country")
      .field("customerId", "customer_id")
      .field("employeeId", "employee_id")
      .relation("details", {
        toModel: "Detail",
        toTable: "order_details",
        cardinality: "1:N",
        on: {
          parentTable: "orders",
          parentColumns: ["id"],
          childTable: "order_details",
          childColumns: ["order_id"],
        },
      })
      .relation("customer", {
        toModel: "Customer",
        toTable: "customers",
        cardinality: "N:1",
        on: {
          parentTable: "orders",
          parentColumns: ["customer_id"],
          childTable: "customers",
          childColumns: ["id"],
        },
      })
      .relation("employee", {
        toModel: "Employee",
        toTable: "employees",
        cardinality: "N:1",
        on: {
          parentTable: "orders",
          parentColumns: ["employee_id"],
          childTable: "employees",
          childColumns: ["id"],
        },
      }),
  )
  .model("Supplier", "suppliers", (m) =>
    m
      .field("id", "id")
      .field("companyName", "company_name")
      .field("contactName", "contact_name")
      .field("contactTitle", "contact_title")
      .field("address", "address")
      .field("city", "city")
      .field("region", "region")
      .field("postalCode", "postal_code")
      .field("country", "country")
      .field("phone", "phone")
      .relation("products", {
        toModel: "Product",
        toTable: "products",
        cardinality: "1:N",
        on: {
          parentTable: "suppliers",
          parentColumns: ["id"],
          childTable: "products",
          childColumns: ["supplier_id"],
        },
      }),
  )
  .model("Product", "products", (m) =>
    m
      .field("id", "id")
      .field("name", "name")
      .field("quantityPerUnit", "qt_per_unit")
      .field("unitPrice", "unit_price")
      .field("unitsInStock", "units_in_stock")
      .field("unitsOnOrder", "units_on_order")
      .field("reorderLevel", "reorder_level")
      .field("discontinued", "discontinued")
      .field("supplierId", "supplier_id")
      .relation("details", {
        toModel: "Detail",
        toTable: "order_details",
        cardinality: "1:N",
        on: {
          parentTable: "products",
          parentColumns: ["id"],
          childTable: "order_details",
          childColumns: ["product_id"],
        },
      })
      .relation("supplier", {
        toModel: "Supplier",
        toTable: "suppliers",
        cardinality: "N:1",
        on: {
          parentTable: "products",
          parentColumns: ["supplier_id"],
          childTable: "suppliers",
          childColumns: ["id"],
        },
      }),
  )
  .model("Detail", "order_details", (m) =>
    m
      .field("unitPrice", "unit_price")
      .field("quantity", "quantity")
      .field("discount", "discount")
      .field("orderId", "order_id")
      .field("productId", "product_id")
      .relation("order", {
        toModel: "Order",
        toTable: "orders",
        cardinality: "N:1",
        on: {
          parentTable: "order_details",
          parentColumns: ["order_id"],
          childTable: "orders",
          childColumns: ["id"],
        },
      })
      .relation("product", {
        toModel: "Product",
        toTable: "products",
        cardinality: "N:1",
        on: {
          parentTable: "order_details",
          parentColumns: ["product_id"],
          childTable: "products",
          childColumns: ["id"],
        },
      }),
  )
  .capabilities({
    postgres: {
      lateral: true,
      jsonAgg: true,
      returning: true,
    },
  })
  .build();

export type NorthwindContract = typeof contract;

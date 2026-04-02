import type { CodecTypes as PgCodecTypes } from "@prisma-next/adapter-postgres/codec-types";
import {
  float8Column,
  int4Column,
  textColumn,
  timestamptzColumn,
} from "@prisma-next/adapter-postgres/column-types";
import { defineContract } from "@prisma-next/sql-contract-ts/contract-builder";
import postgresPack from "@prisma-next/target-postgres/pack";

type CodecTypes = PgCodecTypes;

export const contract = defineContract<CodecTypes>()
  .target(postgresPack)
  .table("customers", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("company_name", { type: textColumn, nullable: false })
      .column("contact_name", { type: textColumn, nullable: false })
      .column("contact_title", { type: textColumn, nullable: false })
      .column("address", { type: textColumn, nullable: false })
      .column("city", { type: textColumn, nullable: false })
      .column("postal_code", { type: textColumn, nullable: true })
      .column("region", { type: textColumn, nullable: true })
      .column("country", { type: textColumn, nullable: false })
      .column("phone", { type: textColumn, nullable: false })
      .column("fax", { type: textColumn, nullable: true })
      .primaryKey(["id"]),
  )
  .table("employees", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("last_name", { type: textColumn, nullable: false })
      .column("first_name", { type: textColumn, nullable: true })
      .column("title", { type: textColumn, nullable: false })
      .column("title_of_courtesy", { type: textColumn, nullable: false })
      .column("birth_date", { type: timestamptzColumn, nullable: false })
      .column("hire_date", { type: timestamptzColumn, nullable: false })
      .column("address", { type: textColumn, nullable: false })
      .column("city", { type: textColumn, nullable: false })
      .column("postal_code", { type: textColumn, nullable: false })
      .column("country", { type: textColumn, nullable: false })
      .column("home_phone", { type: textColumn, nullable: false })
      .column("extension", { type: int4Column, nullable: false })
      .column("notes", { type: textColumn, nullable: false })
      .column("recipient_id", { type: int4Column, nullable: true })
      .primaryKey(["id"])
      .foreignKey(
        ["recipient_id"],
        { table: "employees", columns: ["id"] },
        { name: "employees_recipient_id_employees_id_fk" },
      ),
  )
  .table("orders", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("order_date", { type: timestamptzColumn, nullable: false })
      .column("required_date", { type: timestamptzColumn, nullable: false })
      .column("shipped_date", { type: timestamptzColumn, nullable: true })
      .column("ship_via", { type: int4Column, nullable: false })
      .column("freight", { type: float8Column, nullable: false })
      .column("ship_name", { type: textColumn, nullable: false })
      .column("ship_city", { type: textColumn, nullable: false })
      .column("ship_region", { type: textColumn, nullable: true })
      .column("ship_postal_code", { type: textColumn, nullable: true })
      .column("ship_country", { type: textColumn, nullable: false })
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
  .table("order_details", (t) =>
    t
      .column("unit_price", { type: float8Column, nullable: false })
      .column("quantity", { type: int4Column, nullable: false })
      .column("discount", { type: float8Column, nullable: false })
      .column("order_id", { type: int4Column, nullable: false })
      .column("product_id", { type: int4Column, nullable: false })
      .unique(["order_id", "product_id"])
      .foreignKey(
        ["order_id"],
        { table: "orders", columns: ["id"] },
        { name: "order_details_order_id_orders_id_fk" },
      )
      .foreignKey(
        ["product_id"],
        { table: "products", columns: ["id"] },
        { name: "order_details_product_id_products_id_fk" },
      ),
  )
  .table("products", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("name", { type: textColumn, nullable: false })
      .column("qt_per_unit", { type: textColumn, nullable: false })
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
      ),
  )
  .table("suppliers", (t) =>
    t
      .column("id", { type: int4Column, nullable: false })
      .column("company_name", { type: textColumn, nullable: false })
      .column("contact_name", { type: textColumn, nullable: false })
      .column("contact_title", { type: textColumn, nullable: false })
      .column("address", { type: textColumn, nullable: false })
      .column("city", { type: textColumn, nullable: false })
      .column("region", { type: textColumn, nullable: true })
      .column("postal_code", { type: textColumn, nullable: false })
      .column("country", { type: textColumn, nullable: false })
      .column("phone", { type: textColumn, nullable: false })
      .primaryKey(["id"]),
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
      .field("fax", "fax"),
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
      .field("recipientId", "recipient_id"),
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
      .field("employeeId", "employee_id"),
  )
  .model("Detail", "order_details", (m) =>
    m
      .field("unitPrice", "unit_price")
      .field("quantity", "quantity")
      .field("discount", "discount")
      .field("orderId", "order_id")
      .field("productId", "product_id"),
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
      .field("supplierId", "supplier_id"),
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
      .field("phone", "phone"),
  )
  .capabilities({
    postgres: {
      returning: true,
    },
  })
  .build();

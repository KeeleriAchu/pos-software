# POS Software Class Diagram

This diagram represents the database entities (tables) and their relationships based on the provided SQL setup script. It serves as a class diagram (Entity-Relationship diagram) for the backend of the POS system.

```mermaid
classDiagram
    class Customer {
        +UUID id
        +String name
        +String phone
        +String email
        +String address
        +String notes
        +Integer total_visits
        +DateTime created_at
        +DateTime updated_at
    }

    class Product {
        +UUID id
        +String name
        +Decimal price
        +Decimal cost_price
        +Integer stock
        +String unit
        +Integer low_stock_threshold
        +String category
        +String barcode
        +Boolean is_active
        +DateTime created_at
        +DateTime updated_at
    }

    class Bill {
        +UUID id
        +String bill_number
        +UUID customer_id
        +String customer_name
        +Decimal total_amount
        +Decimal paid_amount
        +Decimal pending_amount
        +Decimal discount_amount
        +String payment_status
        +String payment_method
        +Boolean is_pending_sale
        +String notes
        +DateTime created_at
        +DateTime updated_at
    }

    class BillItem {
        +UUID id
        +UUID bill_id
        +UUID product_id
        +String product_name
        +Integer quantity
        +Decimal unit_price
        +Decimal cost_price
        +Decimal total_price
        +DateTime created_at
    }

    class PendingPayment {
        +UUID id
        +UUID customer_id
        +UUID bill_id
        +Decimal amount_due
        +Decimal amount_paid
        +Date due_date
        +Boolean reminder_sent
        +DateTime last_reminder_at
        +String status
        +String notes
        +DateTime created_at
        +DateTime updated_at
    }

    class PaymentHistory {
        +UUID id
        +UUID customer_id
        +UUID bill_id
        +UUID pending_id
        +Decimal amount
        +String payment_method
        +String note
        +DateTime paid_at
    }

    class CustomerVisit {
        +UUID id
        +UUID customer_id
        +String customer_name
        +Date visit_date
        +UUID bill_id
        +Decimal amount
        +DateTime visited_at
        +DateTime created_at
    }

    class ReminderLog {
        +UUID id
        +UUID customer_id
        +UUID pending_payment_id
        +String type
        +String message
        +String status
        +DateTime sent_at
    }

    class DailySummary {
        +UUID id
        +Date summary_date
        +Decimal total_sales
        +Decimal total_profit
        +Integer total_bills
        +Integer customers_visited
        +DateTime created_at
        +DateTime updated_at
    }

    class AuditLog {
        +UUID id
        +String table_name
        +String action
        +String record_id
        +JSONB old_data
        +JSONB new_data
        +UUID changed_by
        +DateTime changed_at
    }

    class User {
        +UUID id
        +String email
        +String role
    }

    %% Relationships
    Customer "1" -- "0..*" Bill : creates
    Customer "1" -- "0..*" PendingPayment : owes
    Customer "1" -- "0..*" CustomerVisit : makes
    Customer "1" -- "0..*" PaymentHistory : makes
    Customer "1" -- "0..*" ReminderLog : receives

    Bill "1" -- "0..*" BillItem : contains
    Product "1" -- "0..*" BillItem : included in

    Bill "1" -- "0..1" PendingPayment : linked to
    Bill "1" -- "0..*" PaymentHistory : paid via
    Bill "1" -- "0..1" CustomerVisit : generated

    PendingPayment "1" -- "0..*" PaymentHistory : tracks
    PendingPayment "1" -- "0..*" ReminderLog : alerts for

    User "1" -- "0..*" AuditLog : triggers
```

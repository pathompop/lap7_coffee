-- Coffee shop membership and loyalty points schema
-- Compatible with MySQL 5.7+ (CHECK constraints are enforced from MySQL 8.0.16)

CREATE DATABASE IF NOT EXISTS lap_6
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lap_6;

CREATE TABLE IF NOT EXISTS coffees (
  coffee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (coffee_id),
  CONSTRAINT chk_coffees_price_positive CHECK (price > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  member_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (member_no),
  KEY idx_members_name (name),
  KEY idx_members_phone (phone)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_no BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  points_earned INT UNSIGNED NOT NULL,
  status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(255) NULL,
  PRIMARY KEY (purchase_id),
  KEY idx_purchases_member_date (member_no, purchased_at),
  KEY idx_purchases_member_status (member_no, status),
  CONSTRAINT fk_purchases_member
    FOREIGN KEY (member_no) REFERENCES members (member_no)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT chk_purchases_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_purchases_cancel_fields CHECK (
    (status = 'active' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id BIGINT UNSIGNED NOT NULL,
  coffee_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (purchase_item_id),
  UNIQUE KEY uq_purchase_coffee (purchase_id, coffee_id),
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchases (purchase_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_items_coffee
    FOREIGN KEY (coffee_id) REFERENCES coffees (coffee_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_items_price_positive CHECK (unit_price > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO coffees (name, price)
SELECT * FROM (
  SELECT 'อเมริกาโน่' AS name, 60.00 AS price
  UNION ALL SELECT 'ลาเต้', 70.00
  UNION ALL SELECT 'คาปูชิโน่', 75.00
  UNION ALL SELECT 'มอคค่า', 80.00
) AS starter_menu
WHERE NOT EXISTS (SELECT 1 FROM coffees);

CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id BIGINT UNSIGNED NOT NULL,
  coffee_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (purchase_item_id),
  UNIQUE KEY uq_purchase_coffee (purchase_id, coffee_id),
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchases (purchase_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_items_coffee
    FOREIGN KEY (coffee_id) REFERENCES coffees (coffee_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_items_price_positive CHECK (unit_price > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO coffees (name, price)
SELECT * FROM (
  SELECT 'อเมริกาโน่' AS name, 60.00 AS price
  UNION ALL SELECT 'ลาเต้', 70.00
  UNION ALL SELECT 'คาปูชิโน่', 75.00
  UNION ALL SELECT 'มอคค่า', 80.00
) AS starter_menu
WHERE NOT EXISTS (SELECT 1 FROM coffees);

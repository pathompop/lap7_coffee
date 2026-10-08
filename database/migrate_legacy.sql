USE lap_6;

-- Run only for the original empty schema that used members.id and purchases.id.
-- Existing rows must be backed up before applying this migration.
ALTER TABLE members
  DROP COLUMN member_no,
  CHANGE COLUMN id member_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  CHANGE COLUMN full_name name VARCHAR(150) NOT NULL,
  DROP COLUMN total_points,
  MODIFY COLUMN joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  DROP COLUMN created_at;
ALTER TABLE purchases
  CHANGE COLUMN id purchase_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  CHANGE COLUMN member_id member_no BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN earned_points points_earned INT UNSIGNED NOT NULL,
  CHANGE COLUMN purchased_at purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE purchases
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER cancelled_at,
  ADD CONSTRAINT fk_purchases_member FOREIGN KEY (member_no) REFERENCES members (member_no)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

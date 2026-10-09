-- Run once against the existing arduino_store database after taking a backup.
-- The current products table already has a unique index on sku.
USE arduino_store;

ALTER TABLE products
    ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5,
    ADD CONSTRAINT chk_products_low_stock_threshold
        CHECK (low_stock_threshold >= 0);

-- Keep existing non-empty SKUs unchanged. UUID() supplies a unique identifier
-- for each previously unassigned product; uq_products_sku enforces uniqueness.
UPDATE products
SET sku = CONCAT('ARD-', UPPER(REPLACE(UUID(), '-', '')))
WHERE sku IS NULL OR TRIM(sku) = '';

CREATE TABLE stock_transactions (
    id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    variant_id CHAR(36) NULL,
    order_id CHAR(36) NULL,
    order_item_id CHAR(36) NULL,
    movement_type ENUM('IN', 'OUT') NOT NULL,
    quantity INT NOT NULL,
    stock_before INT NOT NULL,
    stock_after INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    actor_id CHAR(36) NULL,
    idempotency_key VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_transactions_idempotency (idempotency_key),
    INDEX idx_stock_transactions_product_created (product_id, created_at),
    INDEX idx_stock_transactions_order (order_id),
    INDEX idx_stock_transactions_variant (variant_id),

    CONSTRAINT fk_stock_transactions_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transactions_variant
        FOREIGN KEY (variant_id)
        REFERENCES variants(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transactions_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transactions_actor
        FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT chk_stock_transactions_quantity CHECK (quantity > 0),
    CONSTRAINT chk_stock_transactions_stock
        CHECK (stock_before >= 0 AND stock_after >= 0)
) ENGINE=InnoDB;

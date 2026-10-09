-- ============================================================
-- Arduino Store
-- MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS arduino_store
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE arduino_store;


-- ============================================================
-- USERS
-- Replacement for Supabase Auth users
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'user',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),

    INDEX idx_users_role (role)
) ENGINE=InnoDB;


-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NULL,
    username VARCHAR(100) NULL,
    first_name VARCHAR(100) NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    suffix VARCHAR(30) NULL,
    contact_number VARCHAR(50) NULL,
    address TEXT NULL,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    rules_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_profiles_username (username),

    CONSTRAINT fk_profiles_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
    id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    parent_id CHAR(36) NULL,
    icon VARCHAR(255) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_categories_slug (slug),

    INDEX idx_categories_parent (parent_id),

    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    price_cents INT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    description TEXT NULL,
    img_url VARCHAR(1000) NULL,
    model_url VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category_id CHAR(36) NULL,
    specs JSON NULL,
    tags JSON NULL,
    weight_g INT NULL,
    sku VARCHAR(100) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_products_slug (slug),
    UNIQUE KEY uq_products_sku (sku),

    INDEX idx_products_category (category_id),
    INDEX idx_products_created (created_at),
    INDEX idx_products_stock (stock),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_products_price
        CHECK (price_cents >= 0),

    CONSTRAINT chk_products_stock
        CHECK (stock >= 0)
) ENGINE=InnoDB;


-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS variants (
    id CHAR(36) NOT NULL,
    product_id CHAR(36) NULL,
    variant_name VARCHAR(255) NOT NULL,
    option_value VARCHAR(255) NOT NULL,
    price_adjustment INT NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    img_url VARCHAR(1000) NULL,

    PRIMARY KEY (id),

    INDEX idx_variants_product (product_id),

    CONSTRAINT fk_variants_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_variants_stock
        CHECK (stock >= 0)
) ENGINE=InnoDB;


-- ============================================================
-- CART ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS cart_items (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_cart_user_product (user_id, product_id),

    INDEX idx_cart_user (user_id),
    INDEX idx_cart_product (product_id),

    CONSTRAINT fk_cart_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_cart_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_cart_qty
        CHECK (qty > 0)
) ENGINE=InnoDB;


-- ============================================================
-- WISHLISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS wishlists (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_wishlist_user_product (user_id, product_id),

    INDEX idx_wishlist_user (user_id),
    INDEX idx_wishlist_product (product_id),

    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_wishlist_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    total_cents INT NOT NULL,
    promo_code VARCHAR(100) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    shipping_address JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipping_method VARCHAR(100) NOT NULL DEFAULT 'standard',
    payment_method VARCHAR(100) NOT NULL DEFAULT 'cod',
    tracking_status VARCHAR(100) NOT NULL DEFAULT 'processing',
    expected_delivery DATE NULL,
    cancelled_at TIMESTAMP NULL,
    cancel_reason TEXT NULL,
    notes TEXT NULL,
    email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (id),

    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created (created_at),

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_orders_total
        CHECK (total_cents >= 0)
) ENGINE=InnoDB;


-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS order_items (
    id CHAR(36) NOT NULL,
    order_id CHAR(36) NULL,
    product_id CHAR(36) NULL,
    variant_id CHAR(36) NULL,
    qty INT NOT NULL,
    price_cents INT NOT NULL,
    product_name VARCHAR(255) NULL,
    product_img VARCHAR(1000) NULL,

    PRIMARY KEY (id),

    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id),
    INDEX idx_order_items_variant (variant_id),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_order_items_variant
        FOREIGN KEY (variant_id)
        REFERENCES variants(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_order_items_qty
        CHECK (qty > 0),

    CONSTRAINT chk_order_items_price
        CHECK (price_cents >= 0)
) ENGINE=InnoDB;


-- ============================================================
-- REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    id CHAR(36) NOT NULL,
    product_id CHAR(36) NULL,
    user_id CHAR(36) NULL,
    rating INT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_reviews_product (product_id),
    INDEX idx_reviews_user (user_id),

    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT chk_reviews_rating
        CHECK (rating >= 1 AND rating <= 5)
) ENGINE=InnoDB;


-- ============================================================
-- PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS promos (
    id CHAR(36) NOT NULL,
    code VARCHAR(100) NOT NULL,
    discount_percent INT NULL,
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP NOT NULL,
    max_uses INT NULL,
    used_count INT NOT NULL DEFAULT 0,
    is_free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    min_order_cents INT NOT NULL DEFAULT 0,
    description TEXT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_promos_code (code),

    INDEX idx_promos_validity (valid_from, valid_until),

    CONSTRAINT chk_promos_discount
        CHECK (
            discount_percent IS NULL
            OR discount_percent >= 0
        ),

    CONSTRAINT chk_promos_max_uses
        CHECK (
            max_uses IS NULL
            OR max_uses >= 0
        ),

    CONSTRAINT chk_promos_used_count
        CHECK (used_count >= 0),

    CONSTRAINT chk_promos_min_order
        CHECK (min_order_cents >= 0)
) ENGINE=InnoDB;


-- ============================================================
-- REFUND REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS refund_requests (
    id CHAR(36) NOT NULL,
    order_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    reason TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,

    PRIMARY KEY (id),

    INDEX idx_refunds_order (order_id),
    INDEX idx_refunds_user (user_id),
    INDEX idx_refunds_status (status),

    CONSTRAINT fk_refunds_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_refunds_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NULL,
    title VARCHAR(255) NULL,
    message TEXT NULL,
    type VARCHAR(100) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_product (product_id),
    INDEX idx_notifications_read (is_read),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_notifications_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- DONE
-- ============================================================
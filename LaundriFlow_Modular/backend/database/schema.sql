CREATE DATABASE IF NOT EXISTS laundriflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laundriflow;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 customer_code VARCHAR(20) UNIQUE NULL,
 full_name VARCHAR(120) NOT NULL,
 username VARCHAR(60) UNIQUE NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin','customer','staff') NOT NULL,
 active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_profiles (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL UNIQUE,
 staff_type ENUM('delivery','laundry') NOT NULL DEFAULT 'delivery',
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS inventory (
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
 quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
 price DECIMAL(10,2) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 order_code VARCHAR(30) UNIQUE NOT NULL,
 customer_id INT NOT NULL,
 service VARCHAR(100) NOT NULL,
 weight DECIMAL(10,2) NOT NULL,
 total DECIMAL(10,2) NOT NULL,
 amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
 fulfillment ENUM('Pickup','Delivery') NOT NULL,
 delivery_staff_id INT NULL,
 status ENUM('Received','Washing','Drying','Ironing','Completed','Ready for Pickup','Picked Up','For Delivery','Delivered') NOT NULL DEFAULT 'Received',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (customer_id) REFERENCES users(id),
 FOREIGN KEY (delivery_staff_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS payments (
 id INT AUTO_INCREMENT PRIMARY KEY,
 order_id INT NOT NULL,
 recorded_by INT NOT NULL,
 amount DECIMAL(10,2) NOT NULL,
 note VARCHAR(255) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE TABLE `Inquiry` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `inquiryNo` VARCHAR(191) NOT NULL,
  `customerId` INTEGER NULL,
  `brandId` INTEGER NULL,
  `platformId` INTEGER NULL,
  `storeId` INTEGER NULL,
  `channelId` INTEGER NULL,
  `countryCode` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `title` VARCHAR(191) NOT NULL,
  `content` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Inquiry_inquiryNo_key`(`inquiryNo`),
  INDEX `Inquiry_customerId_idx`(`customerId`),
  INDEX `Inquiry_brandId_idx`(`brandId`),
  INDEX `Inquiry_platformId_idx`(`platformId`),
  INDEX `Inquiry_storeId_idx`(`storeId`),
  INDEX `Inquiry_channelId_idx`(`channelId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Quote` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `quoteNo` VARCHAR(191) NOT NULL,
  `inquiryId` INTEGER NULL,
  `customerId` INTEGER NULL,
  `brandId` INTEGER NULL,
  `platformId` INTEGER NULL,
  `storeId` INTEGER NULL,
  `channelId` INTEGER NULL,
  `countryCode` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `productAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `shippingFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `otherFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `convertedAt` DATETIME(3) NULL,
  `remark` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Quote_quoteNo_key`(`quoteNo`),
  INDEX `Quote_inquiryId_idx`(`inquiryId`),
  INDEX `Quote_customerId_idx`(`customerId`),
  INDEX `Quote_brandId_idx`(`brandId`),
  INDEX `Quote_platformId_idx`(`platformId`),
  INDEX `Quote_storeId_idx`(`storeId`),
  INDEX `Quote_channelId_idx`(`channelId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuoteItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `quoteId` INTEGER NOT NULL,
  `sku` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `remark` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `QuoteItem_quoteId_idx`(`quoteId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Order` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderNo` VARCHAR(191) NOT NULL,
  `externalOrderNo` VARCHAR(191) NULL,
  `orderSource` VARCHAR(191) NOT NULL,
  `customerId` INTEGER NULL,
  `inquiryId` INTEGER NULL,
  `quoteId` INTEGER NULL,
  `brandId` INTEGER NULL,
  `platformId` INTEGER NULL,
  `storeId` INTEGER NULL,
  `channelId` INTEGER NULL,
  `countryCode` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `productAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `shippingFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `otherFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `paidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `unpaidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `orderStatus` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'unpaid',
  `shippingStatus` VARCHAR(191) NOT NULL DEFAULT 'unshipped',
  `orderDate` DATETIME(3) NOT NULL,
  `expectedShipDate` DATETIME(3) NULL,
  `actualShipDate` DATETIME(3) NULL,
  `dueDate` DATETIME(3) NULL,
  `trackingNo` VARCHAR(191) NULL,
  `logisticsProvider` VARCHAR(191) NULL,
  `remark` TEXT NULL,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
  UNIQUE INDEX `Order_quoteId_key`(`quoteId`),
  INDEX `Order_orderSource_idx`(`orderSource`),
  INDEX `Order_customerId_idx`(`customerId`),
  INDEX `Order_inquiryId_idx`(`inquiryId`),
  INDEX `Order_brandId_idx`(`brandId`),
  INDEX `Order_platformId_idx`(`platformId`),
  INDEX `Order_storeId_idx`(`storeId`),
  INDEX `Order_channelId_idx`(`channelId`),
  INDEX `Order_countryCode_idx`(`countryCode`),
  INDEX `Order_currency_idx`(`currency`),
  INDEX `Order_orderDate_idx`(`orderDate`),
  INDEX `Order_dueDate_idx`(`dueDate`),
  INDEX `Order_orderStatus_idx`(`orderStatus`),
  INDEX `Order_paymentStatus_idx`(`paymentStatus`),
  INDEX `Order_shippingStatus_idx`(`shippingStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `sku` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `costPrice` DECIMAL(18, 2) NULL,
  `totalPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `remark` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `OrderItem_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `Inquiry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `Inquiry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

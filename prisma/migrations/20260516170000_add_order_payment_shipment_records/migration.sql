-- CreateTable
CREATE TABLE `OrderPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `baseAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paymentMethod` VARCHAR(191) NULL,
    `referenceNo` VARCHAR(191) NULL,
    `payerName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'confirmed',
    `remark` TEXT NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderPayment_orderId_idx`(`orderId`),
    INDEX `OrderPayment_paymentDate_idx`(`paymentDate`),
    INDEX `OrderPayment_status_idx`(`status`),
    INDEX `OrderPayment_createdBy_idx`(`createdBy`),
    INDEX `OrderPayment_referenceNo_idx`(`referenceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderShipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `shipmentDate` DATETIME(3) NOT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'shipped',
    `isFinalShipment` BOOLEAN NOT NULL DEFAULT true,
    `logisticsProvider` VARCHAR(191) NULL,
    `trackingNo` VARCHAR(191) NULL,
    `packageCount` INTEGER NOT NULL DEFAULT 1,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `remark` TEXT NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderShipment_orderId_idx`(`orderId`),
    INDEX `OrderShipment_shipmentDate_idx`(`shipmentDate`),
    INDEX `OrderShipment_status_idx`(`status`),
    INDEX `OrderShipment_createdBy_idx`(`createdBy`),
    INDEX `OrderShipment_trackingNo_idx`(`trackingNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill existing order summary fields into the new detail tables.
INSERT INTO `OrderPayment` (`orderId`, `paymentDate`, `amount`, `currency`, `exchangeRate`, `baseAmount`, `paymentMethod`, `referenceNo`, `status`, `createdBy`, `createdAt`, `updatedAt`)
SELECT `id`, `orderDate`, `paidAmount`, `currency`, `exchangeRate`, `paidAmount` * `exchangeRate`, `paymentMethod`, 'legacy-paid-amount', 'confirmed', `createdBy`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Order`
WHERE `paidAmount` > 0;

INSERT INTO `OrderShipment` (`orderId`, `shipmentDate`, `deliveredAt`, `status`, `isFinalShipment`, `logisticsProvider`, `trackingNo`, `packageCount`, `freightAmount`, `currency`, `exchangeRate`, `createdBy`, `createdAt`, `updatedAt`)
SELECT `id`,
       COALESCE(`actualShipDate`, `shipmentDate`, `orderDate`),
       CASE WHEN `shippingStatus` = 'delivered' THEN COALESCE(`actualShipDate`, `shipmentDate`) ELSE NULL END,
       CASE WHEN `shippingStatus` = 'delivered' THEN 'delivered' ELSE 'shipped' END,
       CASE WHEN `shippingStatus` = 'partial_shipped' THEN false ELSE true END,
       `logisticsProvider`,
       `trackingNo`,
       1,
       0,
       `currency`,
       `exchangeRate`,
       `createdBy`,
       CURRENT_TIMESTAMP(3),
       CURRENT_TIMESTAMP(3)
FROM `Order`
WHERE `shippingStatus` IN ('partial_shipped', 'shipped', 'delivered') OR `shipmentDate` IS NOT NULL OR `actualShipDate` IS NOT NULL OR `trackingNo` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `OrderPayment` ADD CONSTRAINT `OrderPayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderPayment` ADD CONSTRAINT `OrderPayment_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderShipment` ADD CONSTRAINT `OrderShipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderShipment` ADD CONSTRAINT `OrderShipment_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

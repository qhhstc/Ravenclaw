-- AlterTable
ALTER TABLE `Order` ADD COLUMN `baseCurrency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    ADD COLUMN `customerName` VARCHAR(191) NULL,
    ADD COLUMN `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    ADD COLUMN `grossMargin` DECIMAL(9, 4) NULL,
    ADD COLUMN `grossProfit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `salesAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `salespersonId` INTEGER NULL,
    ADD COLUMN `shipmentDate` DATETIME(3) NULL,
    ADD COLUMN `totalCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    MODIFY `orderSource` VARCHAR(191) NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `packagingCostSubtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `packagingUnitCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `productId` INTEGER NULL,
    ADD COLUMN `purchaseCostSubtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `purchaseUnitCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `saleUnitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `salesSubtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `specification` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NULL,
    `remark` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `specification` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `defaultPurchasePrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `defaultPackagingCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `weight` DECIMAL(18, 3) NULL,
    `volume` DECIMAL(18, 3) NULL,
    `defaultVendorId` INTEGER NULL,
    `brandId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `remark` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_defaultVendorId_idx`(`defaultVendorId`),
    INDEX `Product_brandId_idx`(`brandId`),
    INDEX `Product_status_idx`(`status`),
    INDEX `Product_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderCost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `costType` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `baseAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remark` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderCost_orderId_idx`(`orderId`),
    INDEX `OrderCost_costType_idx`(`costType`),
    UNIQUE INDEX `OrderCost_orderId_costType_key`(`orderId`, `costType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_customerName_idx` ON `Order`(`customerName`);

-- CreateIndex
CREATE INDEX `Order_salespersonId_idx` ON `Order`(`salespersonId`);

-- CreateIndex
CREATE INDEX `Order_shipmentDate_idx` ON `Order`(`shipmentDate`);

-- CreateIndex
CREATE INDEX `OrderItem_productId_idx` ON `OrderItem`(`productId`);

-- CreateIndex
CREATE INDEX `OrderItem_sku_idx` ON `OrderItem`(`sku`);

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_defaultVendorId_fkey` FOREIGN KEY (`defaultVendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_salespersonId_fkey` FOREIGN KEY (`salespersonId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderCost` ADD CONSTRAINT `OrderCost_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Vendor`
    ADD COLUMN `vendorType` VARCHAR(191) NOT NULL DEFAULT 'supplier',
    ADD COLUMN `countryCode` VARCHAR(191) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `whatsapp` VARCHAR(191) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Vendor_name_key` ON `Vendor`(`name`);

-- CreateIndex
CREATE INDEX `Vendor_vendorType_idx` ON `Vendor`(`vendorType`);

-- CreateIndex
CREATE INDEX `Vendor_countryCode_idx` ON `Vendor`(`countryCode`);

-- CreateIndex
CREATE INDEX `Vendor_status_idx` ON `Vendor`(`status`);

-- CreateTable
CREATE TABLE `OrderStatusLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `remark` TEXT NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusLog_orderId_idx`(`orderId`),
    INDEX `OrderStatusLog_toStatus_idx`(`toStatus`),
    INDEX `OrderStatusLog_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bizType` VARCHAR(191) NOT NULL,
    `bizId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NOT NULL DEFAULT 0,
    `attachmentType` VARCHAR(191) NOT NULL DEFAULT 'other',
    `uploadedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attachment_bizType_bizId_idx`(`bizType`, `bizId`),
    INDEX `Attachment_attachmentType_idx`(`attachmentType`),
    INDEX `Attachment_uploadedBy_idx`(`uploadedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderStatusLog` ADD CONSTRAINT `OrderStatusLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusLog` ADD CONSTRAINT `OrderStatusLog_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

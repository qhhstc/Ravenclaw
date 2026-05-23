-- AlterTable
ALTER TABLE `OrderItem`
    ADD COLUMN `productNameCn` VARCHAR(191) NULL,
    ADD COLUMN `productNameEn` VARCHAR(191) NULL;

-- Backfill existing display name to English name for compatibility.
UPDATE `OrderItem`
SET `productNameEn` = `productName`
WHERE `productNameEn` IS NULL;

-- CreateIndex
CREATE INDEX `OrderItem_productNameCn_idx` ON `OrderItem`(`productNameCn`);

-- CreateIndex
CREATE INDEX `OrderItem_productNameEn_idx` ON `OrderItem`(`productNameEn`);

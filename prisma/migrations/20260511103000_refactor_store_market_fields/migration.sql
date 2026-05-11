-- AlterTable
ALTER TABLE `Store`
    DROP COLUMN `marketCountry`,
    DROP COLUMN `currency`,
    DROP COLUMN `businessType`,
    ADD COLUMN `storeType` VARCHAR(191) NOT NULL,
    ADD COLUMN `marketScope` VARCHAR(191) NOT NULL,
    ADD COLUMN `primaryMarketCode` VARCHAR(191) NULL,
    ADD COLUMN `defaultCurrency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    ADD COLUMN `settlementCurrency` VARCHAR(191) NULL,
    ADD COLUMN `remark` TEXT NULL;

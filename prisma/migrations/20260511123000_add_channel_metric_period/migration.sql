-- CreateTable
CREATE TABLE `ChannelMetricPeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `quarter` INTEGER NOT NULL,
    `weekNumber` INTEGER NULL,
    `periodType` VARCHAR(191) NOT NULL,
    `brandId` INTEGER NOT NULL,
    `platformId` INTEGER NOT NULL,
    `storeId` INTEGER NULL,
    `channelId` INTEGER NOT NULL,
    `countryCode` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL,
    `salesAmountOriginal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `adSpendOriginal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refundAmountOriginal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `visitorCount` INTEGER NOT NULL DEFAULT 0,
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `salesAmountBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `adSpendBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refundAmountBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remark` TEXT NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChannelMetricPeriod_year_month_idx`(`year`, `month`),
    INDEX `ChannelMetricPeriod_year_quarter_idx`(`year`, `quarter`),
    INDEX `ChannelMetricPeriod_brandId_idx`(`brandId`),
    INDEX `ChannelMetricPeriod_platformId_idx`(`platformId`),
    INDEX `ChannelMetricPeriod_storeId_idx`(`storeId`),
    INDEX `ChannelMetricPeriod_channelId_idx`(`channelId`),
    UNIQUE INDEX `cmp_week_channel_unique`(`year`, `month`, `periodType`, `weekNumber`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChannelMetricPeriod` ADD CONSTRAINT `ChannelMetricPeriod_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelMetricPeriod` ADD CONSTRAINT `ChannelMetricPeriod_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelMetricPeriod` ADD CONSTRAINT `ChannelMetricPeriod_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelMetricPeriod` ADD CONSTRAINT `ChannelMetricPeriod_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelMetricPeriod` ADD CONSTRAINT `ChannelMetricPeriod_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

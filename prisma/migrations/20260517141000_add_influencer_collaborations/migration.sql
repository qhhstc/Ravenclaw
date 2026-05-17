-- CreateTable
CREATE TABLE `InfluencerCollaboration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `influencerName` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `accountHandle` VARCHAR(191) NULL,
    `profileUrl` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `followerCount` INTEGER NOT NULL DEFAULT 0,
    `avgViews` INTEGER NOT NULL DEFAULT 0,
    `contentCategory` VARCHAR(191) NULL,
    `cooperationType` VARCHAR(191) NOT NULL DEFAULT 'sample',
    `status` VARCHAR(191) NOT NULL DEFAULT 'prospecting',
    `brandId` INTEGER NULL,
    `channelId` INTEGER NULL,
    `ownerId` INTEGER NULL,
    `contactName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `sampleSku` VARCHAR(191) NULL,
    `sampleQuantity` INTEGER NOT NULL DEFAULT 0,
    `sampleCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `feeAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `totalCostBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `contentCount` INTEGER NOT NULL DEFAULT 0,
    `postUrl` VARCHAR(191) NULL,
    `couponCode` VARCHAR(191) NULL,
    `salesAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `roi` DECIMAL(18, 6) NULL,
    `rating` VARCHAR(191) NULL,
    `nextFollowupAt` DATETIME(3) NULL,
    `remark` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InfluencerCollaboration_influencerName_idx`(`influencerName`),
    INDEX `InfluencerCollaboration_platform_idx`(`platform`),
    INDEX `InfluencerCollaboration_status_idx`(`status`),
    INDEX `InfluencerCollaboration_cooperationType_idx`(`cooperationType`),
    INDEX `InfluencerCollaboration_brandId_idx`(`brandId`),
    INDEX `InfluencerCollaboration_channelId_idx`(`channelId`),
    INDEX `InfluencerCollaboration_ownerId_idx`(`ownerId`),
    INDEX `InfluencerCollaboration_nextFollowupAt_idx`(`nextFollowupAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InfluencerCollaboration` ADD CONSTRAINT `InfluencerCollaboration_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfluencerCollaboration` ADD CONSTRAINT `InfluencerCollaboration_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfluencerCollaboration` ADD CONSTRAINT `InfluencerCollaboration_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

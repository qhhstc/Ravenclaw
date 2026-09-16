-- CreateTable
CREATE TABLE `ChannelEntryAudit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `channelId` INTEGER NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL DEFAULT 'update',
    `beforeValue` TEXT NULL,
    `afterValue` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChannelEntryAudit_year_month_idx`(`year`, `month`),
    INDEX `ChannelEntryAudit_channelId_idx`(`channelId`),
    INDEX `ChannelEntryAudit_actorName_idx`(`actorName`),
    INDEX `ChannelEntryAudit_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChannelEntryAudit` ADD CONSTRAINT `ChannelEntryAudit_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

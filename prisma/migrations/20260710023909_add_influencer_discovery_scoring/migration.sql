-- CreateTable
CREATE TABLE `InfluencerDiscoveryRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `websiteUrl` VARCHAR(191) NOT NULL,
    `websiteDomain` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `source` VARCHAR(191) NOT NULL DEFAULT 'website',
    `brandName` VARCHAR(191) NULL,
    `brandSummary` TEXT NULL,
    `productSummary` TEXT NULL,
    `audienceSummary` TEXT NULL,
    `creatorPersona` TEXT NULL,
    `keywordsJson` JSON NULL,
    `analysisJson` JSON NULL,
    `errorMessage` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InfluencerDiscoveryRun_status_idx`(`status`),
    INDEX `InfluencerDiscoveryRun_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfluencerCandidate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discoveryRunId` INTEGER NULL,
    `platform` VARCHAR(191) NULL,
    `handle` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `profileUrl` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `followers` INTEGER NULL,
    `avgViews` INTEGER NULL,
    `engagementRate` DECIMAL(10, 4) NULL,
    `avgLikes` INTEGER NULL,
    `avgComments` INTEGER NULL,
    `recentPostCount` INTEGER NULL,
    `nicheTagsJson` JSON NULL,
    `matchedKeywordsJson` JSON NULL,
    `audienceJson` JSON NULL,
    `contentSamplesJson` JSON NULL,
    `rawDataJson` JSON NULL,
    `score` INTEGER NULL,
    `tier` VARCHAR(191) NULL,
    `recommendedOffer` VARCHAR(191) NULL,
    `recommendedProducts` TEXT NULL,
    `scoreDetailsJson` JSON NULL,
    `aiReason` TEXT NULL,
    `riskNotes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `source` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InfluencerCandidate_discoveryRunId_idx`(`discoveryRunId`),
    INDEX `InfluencerCandidate_platform_idx`(`platform`),
    INDEX `InfluencerCandidate_score_idx`(`score`),
    INDEX `InfluencerCandidate_tier_idx`(`tier`),
    INDEX `InfluencerCandidate_status_idx`(`status`),
    INDEX `InfluencerCandidate_profileUrl_idx`(`profileUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfluencerScoringRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `ruleJson` JSON NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InfluencerDiscoveryRun` ADD CONSTRAINT `InfluencerDiscoveryRun_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfluencerCandidate` ADD CONSTRAINT `InfluencerCandidate_discoveryRunId_fkey` FOREIGN KEY (`discoveryRunId`) REFERENCES `InfluencerDiscoveryRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

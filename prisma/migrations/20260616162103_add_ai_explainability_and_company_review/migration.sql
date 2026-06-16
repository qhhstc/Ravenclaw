-- AlterTable
ALTER TABLE `BusinessBlockPlan` ADD COLUMN `aiConfidence` VARCHAR(191) NULL,
    ADD COLUMN `aiDataCoverage` TEXT NULL,
    ADD COLUMN `aiModel` VARCHAR(191) NULL,
    ADD COLUMN `aiRatingReason` TEXT NULL,
    ADD COLUMN `confirmedAt` DATETIME(3) NULL,
    ADD COLUMN `confirmedBy` INTEGER NULL,
    ADD COLUMN `decisionStatus` VARCHAR(191) NOT NULL DEFAULT 'ai_suggested';

-- AlterTable
ALTER TABLE `ChannelMetricPeriod` ADD COLUMN `aiConfidence` VARCHAR(191) NULL,
    ADD COLUMN `aiDataCoverage` TEXT NULL,
    ADD COLUMN `aiModel` VARCHAR(191) NULL,
    ADD COLUMN `aiRatingReason` TEXT NULL;

-- CreateTable
CREATE TABLE `CompanyMonthlyReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `brandId` INTEGER NULL,
    `salesAmountBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `adSpendBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `grossProfitBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `grossMargin` DECIMAL(18, 6) NULL,
    `roi` DECIMAL(18, 6) NULL,
    `overallRating` VARCHAR(191) NULL,
    `overallSummary` TEXT NULL,
    `topPriority` TEXT NULL,
    `capitalShiftSuggestion` TEXT NULL,
    `aiRiskNotes` JSON NULL,
    `aiModel` VARCHAR(191) NULL,
    `aiConfidence` VARCHAR(191) NULL,
    `aiAnalysisStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `aiAnalyzedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyMonthlyReview_year_month_idx`(`year`, `month`),
    UNIQUE INDEX `cmr_month_brand_unique`(`year`, `month`, `brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

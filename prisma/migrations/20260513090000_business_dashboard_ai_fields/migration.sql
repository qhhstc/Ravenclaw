ALTER TABLE `ChannelMetricPeriod`
  ADD COLUMN `businessBlock` VARCHAR(191) NULL,
  ADD COLUMN `productCostBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `otherCostBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `manualRating` VARCHAR(191) NULL,
  ADD COLUMN `aiRating` VARCHAR(191) NULL,
  ADD COLUMN `ratingSource` VARCHAR(191) NOT NULL DEFAULT 'none',
  ADD COLUMN `aiAnalysisStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
  ADD COLUMN `aiActionSuggestion` TEXT NULL,
  ADD COLUMN `manualActionSuggestion` TEXT NULL,
  ADD COLUMN `aiRiskNotes` TEXT NULL,
  ADD COLUMN `warningType` VARCHAR(191) NULL,
  ADD COLUMN `warningLevel` VARCHAR(191) NULL,
  ADD COLUMN `decisionOwner` VARCHAR(191) NULL,
  ADD COLUMN `decisionDeadline` DATETIME(3) NULL,
  ADD COLUMN `nextBudgetBase` DECIMAL(18, 2) NULL,
  ADD COLUMN `budgetAdjustReason` TEXT NULL,
  ADD COLUMN `aiAnalyzedAt` DATETIME(3) NULL;

CREATE INDEX `ChannelMetricPeriod_businessBlock_idx` ON `ChannelMetricPeriod`(`businessBlock`);
CREATE INDEX `ChannelMetricPeriod_ratingSource_idx` ON `ChannelMetricPeriod`(`ratingSource`);
CREATE INDEX `ChannelMetricPeriod_aiAnalysisStatus_idx` ON `ChannelMetricPeriod`(`aiAnalysisStatus`);
CREATE INDEX `ChannelMetricPeriod_warningLevel_idx` ON `ChannelMetricPeriod`(`warningLevel`);
CREATE INDEX `ChannelMetricPeriod_decisionDeadline_idx` ON `ChannelMetricPeriod`(`decisionDeadline`);

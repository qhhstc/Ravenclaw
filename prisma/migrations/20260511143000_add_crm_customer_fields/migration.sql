ALTER TABLE `Customer`
  ADD COLUMN `companyName` VARCHAR(191) NULL,
  MODIFY COLUMN `level` VARCHAR(191) NOT NULL DEFAULT 'C',
  MODIFY COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  ADD COLUMN `lastFollowupAt` DATETIME(3) NULL,
  ADD COLUMN `nextFollowupAt` DATETIME(3) NULL;

ALTER TABLE `CustomerFollowup`
  ADD COLUMN `result` TEXT NULL;

CREATE INDEX `Customer_countryCode_idx` ON `Customer`(`countryCode`);
CREATE INDEX `Customer_status_idx` ON `Customer`(`status`);
CREATE INDEX `Customer_level_idx` ON `Customer`(`level`);
CREATE INDEX `Customer_nextFollowupAt_idx` ON `Customer`(`nextFollowupAt`);
CREATE INDEX `CustomerFollowup_nextFollowupAt_idx` ON `CustomerFollowup`(`nextFollowupAt`);

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `influencerCollaborationId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Order_influencerCollaborationId_idx` ON `Order`(`influencerCollaborationId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_influencerCollaborationId_fkey` FOREIGN KEY (`influencerCollaborationId`) REFERENCES `InfluencerCollaboration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

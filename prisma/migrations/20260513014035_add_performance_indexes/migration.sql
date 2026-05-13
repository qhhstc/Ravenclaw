-- CreateIndex
CREATE INDEX `ChannelMetricPeriod_periodType_idx` ON `ChannelMetricPeriod`(`periodType`);

-- CreateIndex
CREATE INDEX `ChannelMetricPeriod_weekNumber_idx` ON `ChannelMetricPeriod`(`weekNumber`);

-- CreateIndex
CREATE INDEX `Customer_name_idx` ON `Customer`(`name`);

-- CreateIndex
CREATE INDEX `Customer_email_idx` ON `Customer`(`email`);

-- CreateIndex
CREATE INDEX `Inquiry_inquiryNo_idx` ON `Inquiry`(`inquiryNo`);

-- CreateIndex
CREATE INDEX `Inquiry_status_idx` ON `Inquiry`(`status`);

-- CreateIndex
CREATE INDEX `Inquiry_createdAt_idx` ON `Inquiry`(`createdAt`);

-- CreateIndex
CREATE INDEX `Order_orderNo_idx` ON `Order`(`orderNo`);

-- CreateIndex
CREATE INDEX `OrderItem_productName_idx` ON `OrderItem`(`productName`);

-- CreateIndex
CREATE INDEX `Product_name_idx` ON `Product`(`name`);

-- RenameIndex
ALTER TABLE `Order` RENAME INDEX `Order_createdBy_fkey` TO `Order_createdBy_idx`;

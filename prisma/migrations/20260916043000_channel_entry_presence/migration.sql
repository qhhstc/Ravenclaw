-- Nullable markers leave legacy zero values explicitly unknown.
ALTER TABLE `ChannelMetricPeriod`
    ADD COLUMN `entrySalesEntered` BOOLEAN NULL,
    ADD COLUMN `entryAdSpendEntered` BOOLEAN NULL;

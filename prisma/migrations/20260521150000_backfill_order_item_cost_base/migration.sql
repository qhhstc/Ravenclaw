UPDATE `OrderItem`
SET
  `purchaseCostBase` = `purchaseCostSubtotal`,
  `packagingCostBase` = `packagingCostSubtotal`
WHERE `purchaseCostBase` = 0
  AND `packagingCostBase` = 0;

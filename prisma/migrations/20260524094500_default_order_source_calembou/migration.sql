-- Align the database default with the customer-required order source options.
ALTER TABLE `Order`
    MODIFY `orderSource` VARCHAR(191) NOT NULL DEFAULT 'calembou';

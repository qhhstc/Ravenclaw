-- A reversible, month-scoped entry cutoff. No channel or metric records are deleted.
ALTER TABLE `Channel` ADD COLUMN `entryDisabledFromMonth` INTEGER NULL;

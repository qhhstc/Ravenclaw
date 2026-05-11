import { basicResourceConfigs, createItemHandlers } from "@/lib/basic-data-api";

const handlers = createItemHandlers(basicResourceConfigs.stores);

export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;

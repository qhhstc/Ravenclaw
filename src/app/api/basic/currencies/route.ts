import { basicResourceConfigs, createCollectionHandlers } from "@/lib/basic-data-api";

const handlers = createCollectionHandlers(basicResourceConfigs.currencies);

export const GET = handlers.GET;
export const POST = handlers.POST;

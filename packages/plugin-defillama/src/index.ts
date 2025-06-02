import type { Plugin } from "@elizaos/core"
import { YieldProvider } from "./providers/index";
import { GetStablecoinYieldOpportunitiesAction, GetYieldOpportunitiesAction, GetSolanaStablecoinYieldsAction, GetBestSolanaRaydiumPoolApyAction } from "./actions/index";

export const defillamaPlugin: Plugin = {
  name: "defillama",
  description: "DefiLlama Yield Plugin with Yield Opportunities Actions and Provider",
  actions: [
    new GetStablecoinYieldOpportunitiesAction(),
    new GetYieldOpportunitiesAction(),
    new GetSolanaStablecoinYieldsAction(),
    new GetBestSolanaRaydiumPoolApyAction()
  ],
  evaluators: [],
  providers: [new YieldProvider()]
};

export default defillamaPlugin;

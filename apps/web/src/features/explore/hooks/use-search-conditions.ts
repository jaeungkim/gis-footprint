import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "@/features/explore/utils/search-params";

export const useSearchConditions = () => useQueryStates(searchParamsParsers);

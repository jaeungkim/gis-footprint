import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "../_lib/search-params";

export const useSearchConditions = () => useQueryStates(searchParamsParsers);

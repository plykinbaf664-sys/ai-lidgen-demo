import { requirePrivateApi } from "@/lib/security/api-access";
import { formatPublicError } from "@/lib/leadgen/error-format";
import { NextResponse } from "next/server";
import {
  createLeadgenSearchProvider,
  isLeadgenSearchProviderMode,
} from "@/lib/leadgen/search/leadgen-search-provider";

function formatRouteError(error: unknown): string {
  return formatPublicError(error, "Не удалось выполнить тестовый поиск.");
}

export async function GET(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim();

    if (!query || query.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "query parameter is required",
        },
        { status: 400 },
      );
    }

    const providerParam = url.searchParams.get("provider");
    const marketParam = url.searchParams.get("market");
    const languageParam = url.searchParams.get("language");
    const provider = createLeadgenSearchProvider({
      mode: isLeadgenSearchProviderMode(providerParam) ? providerParam : undefined,
    });
    const results = await provider.search({
      query,
      maxResults: 5,
      market: marketParam === "ru" ? "ru" : "global",
      queryLanguage: languageParam === "ru" ? "ru" : "en",
    });

    return NextResponse.json({
      success: true,
      query,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: formatRouteError(error),
      },
      { status: 500 },
    );
  }
}

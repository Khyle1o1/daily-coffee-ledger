import { forwardRef } from "react";
import type { ReportType } from "@/lib/supabase-types";
import type { Category } from "@/utils/types";
import type {
  ComputedSalesMix,
  ComputedProductMix,
  ComputedTop5,
  ComputedCategoryPerformance,
  ComputedProductMixByCategory,
} from "@/lib/reports/compute";
import type { ProductMixChannelData } from "@/lib/reports/computeProductMixChannel";
import type { PourReportData } from "@/lib/reports/computePourItForward";

import SalesMixOverviewReport from "./renderers/SalesMixOverviewReport";
import ProductMixReport from "./renderers/ProductMixReport";
import ProductMixByCategoryReport from "./renderers/ProductMixByCategoryReport";
import Top5ProductsReport from "./renderers/Top5ProductsReport";
import RunningSalesMixCategoryReport from "./renderers/RunningSalesMixCategoryReport";
import CategoryPerformanceReport from "./renderers/CategoryPerformanceReport";
import ProductMixChannelReport from "./renderers/ProductMixChannelReport";
import PourItForwardReport from "./renderers/PourItForwardReport";

export interface ReportCanvasData {
  reportType: ReportType;
  branchLabel: string;
  dateRangeLabel: string;
  compareLabel?: string;
  selectedCategories: Category[];
  // Populated depending on reportType
  salesMix?: ComputedSalesMix;
  productMix?: ComputedProductMix;
  productMixByCategory?: ComputedProductMixByCategory;
  productMixChannel?: ProductMixChannelData;
  top5?: ComputedTop5;
  runningSalesMixCategory?: ComputedProductMix;
  categoryPerformance?: ComputedCategoryPerformance;
  runningSalesCategory?: Category;
  pourItForward?: PourReportData;
}

interface Props {
  data: ReportCanvasData;
}

const ReportCanvas = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  return (
    <div
      ref={ref}
      id="report-canvas"
      className="bg-white shadow-2xl border border-slate-200 rounded-sm overflow-hidden"
      style={{ minWidth: 700 }}
    >
      {data.reportType === "SALES_MIX_OVERVIEW" && data.salesMix && (
        <SalesMixOverviewReport
          data={data.salesMix}
          branchLabel={data.branchLabel}
          dateRangeLabel={data.dateRangeLabel}
        />
      )}

      {data.reportType === "PRODUCT_MIX" && data.productMixByCategory && (
        <ProductMixByCategoryReport
          data={data.productMixByCategory}
          branchLabel={data.branchLabel}
          dateRangeLabel={data.dateRangeLabel}
          compareLabel={data.compareLabel}
        />
      )}

      {data.reportType === "PRODUCT_MIX" && !data.productMixByCategory && data.productMix && (
        <ProductMixReport
          data={data.productMix}
          branchLabel={data.branchLabel}
          dateRangeLabel={data.dateRangeLabel}
          compareLabel={data.compareLabel}
        />
      )}

      {data.reportType === "PRODUCT_MIX_CHANNEL" && data.productMixChannel && (
        <ProductMixChannelReport
          data={data.productMixChannel}
          branchLabel={data.branchLabel}
        />
      )}

      {data.reportType === "TOP_5_PRODUCTS" && data.top5 && (
        <Top5ProductsReport
          data={data.top5}
          selectedCategories={data.selectedCategories}
          branchLabel={data.branchLabel}
          dateRangeLabel={data.dateRangeLabel}
        />
      )}

      {data.reportType === "RUNNING_SALES_MIX_CATEGORY" &&
        data.runningSalesMixCategory &&
        data.runningSalesCategory && (
          <RunningSalesMixCategoryReport
            data={data.runningSalesMixCategory}
            category={data.runningSalesCategory}
            branchLabel={data.branchLabel}
            dateRangeLabel={data.dateRangeLabel}
            compareLabel={data.compareLabel}
          />
        )}

      {data.reportType === "CATEGORY_PERFORMANCE" && data.categoryPerformance && (
        <CategoryPerformanceReport
          data={data.categoryPerformance}
          branchLabel={data.branchLabel}
          dateRangeLabel={data.dateRangeLabel}
        />
      )}

      {data.reportType === "POUR_IT_FORWARD" && data.pourItForward && (
        <PourItForwardReport data={data.pourItForward} />
      )}
    </div>
  );
});

ReportCanvas.displayName = "ReportCanvas";

export default ReportCanvas;

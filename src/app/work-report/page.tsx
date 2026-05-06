import { WorkReportForm } from '@/components/work-report-form';

export default function WorkReportPage() {
  return (
    <div className="overflow-x-hidden">
      <div className="py-8 sm:py-12 max-w-full">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-1 sm:mb-2">Submit Work Report</h1>
            <p className="text-sm text-muted-foreground">
              Submit your daily work report
            </p>
          </div>
          <WorkReportForm />
        </div>
      </div>
    </div>
  );
}

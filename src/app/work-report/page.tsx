import { WorkReportForm } from '@/components/work-report-form';

export default function WorkReportPage() {
  return (
    <div className="min-h-screen pt-16 overflow-x-hidden">
      <div className="container py-6 sm:py-12 px-3 sm:px-4 md:px-6 max-w-full">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-5 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Submit Work Report</h1>
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

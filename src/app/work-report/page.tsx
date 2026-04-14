import { WorkReportForm } from '@/components/work-report-form';

export default function WorkReportPage() {
  return (
    <div className="min-h-screen pt-16">
      <div className="container py-12 px-4 md:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Submit Work Report</h1>
            <p className="text-muted-foreground">
              Submit your daily work report
            </p>
          </div>
          <WorkReportForm />
        </div>
      </div>
    </div>
  );
}

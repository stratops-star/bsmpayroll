import AccessGate from '@/components/AccessGate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AccessGate requireDepartment="payroll">{children}</AccessGate>
}

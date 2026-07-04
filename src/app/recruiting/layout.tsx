import AccessGate from '@/components/AccessGate'

export default function RecruitingLayout({ children }: { children: React.ReactNode }) {
  return <AccessGate requireDepartment="recruiting">{children}</AccessGate>
}

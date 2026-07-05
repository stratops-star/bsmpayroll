import AccessGate from '@/components/AccessGate'
import NavBar from '@/components/NavBar'

export default function RecruitingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate requireDepartment="recruiting">
      <NavBar />
      {children}
    </AccessGate>
  )
}

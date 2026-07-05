import AccessGate from '@/components/AccessGate'
import NavBar from '@/components/NavBar'
import { RecruitingChromeProvider } from '@/components/RecruitingChrome'

export default function RecruitingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate requireDepartment="recruiting">
      <RecruitingChromeProvider>
        <NavBar />
        {children}
      </RecruitingChromeProvider>
    </AccessGate>
  )
}

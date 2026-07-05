import AccessGate from '@/components/AccessGate'
import NavBar from '@/components/NavBar'
import { RecruitingChromeProvider } from '@/components/RecruitingChrome'
import { RecruitingLangProvider } from '@/components/recruiting-i18n'

export default function RecruitingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate requireDepartment="recruiting">
      <RecruitingLangProvider>
        <RecruitingChromeProvider>
          <NavBar />
          {children}
        </RecruitingChromeProvider>
      </RecruitingLangProvider>
    </AccessGate>
  )
}

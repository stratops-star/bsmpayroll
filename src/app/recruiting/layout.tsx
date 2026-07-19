import AccessGate from '@/components/AccessGate'
import BsmHeader from '@/components/BsmHeader'
import RecruitingHeaderActions from '@/components/RecruitingHeaderActions'
import { RecruitingChromeProvider } from '@/components/RecruitingChrome'
import { RecruitingLangProvider } from '@/components/recruiting-i18n'

export default function RecruitingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate requireDepartment="recruiting">
      <RecruitingLangProvider>
        <RecruitingChromeProvider>
          <BsmHeader area="Recruiting" right={<RecruitingHeaderActions />} />
          {children}
        </RecruitingChromeProvider>
      </RecruitingLangProvider>
    </AccessGate>
  )
}

import { RecruitingLangProvider } from '@/components/recruiting-i18n'

export default function ManpowerLayout({ children }: { children: React.ReactNode }) {
  return <RecruitingLangProvider>{children}</RecruitingLangProvider>
}

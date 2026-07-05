'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type Chrome = { actions: ReactNode; setActions: (n: ReactNode) => void }
const Ctx = createContext<Chrome>({ actions: null, setActions: () => {} })

export function RecruitingChromeProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null)
  return <Ctx.Provider value={{ actions, setActions }}>{children}</Ctx.Provider>
}

export const useRecruitingChrome = () => useContext(Ctx)

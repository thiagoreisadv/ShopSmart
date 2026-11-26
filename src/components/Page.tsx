import { type ReactNode, useEffect, useState } from 'react'
import { IconButton } from './ui'
import { back, navigate } from '@/router'

export function Page({
  title,
  subtitle,
  actions,
  backTo,
  noGear,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  backTo?: string
  noGear?: boolean
  children: ReactNode
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <>
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="row-s grow" style={{ minWidth: 0 }}>
          {backTo && <IconButton icon="ArrowLeft" label="Voltar" onClick={() => back(backTo)} />}
          <div style={{ minWidth: 0 }}>
            <h1 className="ellipsis">{title}</h1>
            {subtitle && <p className="sub ellipsis">{subtitle}</p>}
          </div>
        </div>
        <div className="row-s">
          {actions}
          {!noGear && <IconButton icon="Settings" label="Configurações" onClick={() => navigate('/config')} />}
        </div>
      </header>
      <div className="content stack">{children}</div>
    </>
  )
}

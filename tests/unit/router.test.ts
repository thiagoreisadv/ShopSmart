import { describe, it, expect } from 'vitest'
import { canonicalRoute, tabOf } from '@/router'

describe('rotas simplificadas', () => {
  it('rotas antigas apontam para os novos destinos', () => {
    expect(canonicalRoute('/compra')).toBe('/comprar')
    expect(canonicalRoute('/financas')).toBe('/gastos')
    expect(canonicalRoute('/mais/comparador')).toBe('/listas/comparar')
    expect(canonicalRoute('/mais/compras')).toBe('/gastos/compras')
    expect(canonicalRoute('/mais/backup')).toBe('/config')
    expect(canonicalRoute('/mais/unidade')).toBe('/ferramentas/unidade')
    expect(canonicalRoute('/listas')).toBe('/listas')
  })
  it('apenas 4 abas; ferramentas, catálogo e config ficam sob Início', () => {
    expect(tabOf('/')).toBe('/')
    expect(tabOf('/listas/comparar')).toBe('/listas')
    expect(tabOf('/comprar')).toBe('/comprar')
    expect(tabOf('/gastos/compras')).toBe('/gastos')
    expect(tabOf('/ferramentas/unidade')).toBe('/')
    expect(tabOf('/catalogo')).toBe('/')
    expect(tabOf('/mais/compras')).toBe('/gastos')
  })
})

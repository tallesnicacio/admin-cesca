import { getChaveGira, getDataGira } from './giraUtils'

describe('datas de gira vindas do PostgreSQL', () => {
  test.each([
    ['2026-07-17', '2026-07-17'],
    ['2026-07-17T00:00:00.000Z', '2026-07-17'],
    ['2026-07-17T03:00:00+03:00', '2026-07-17']
  ])('aceita %s', (valor, chave) => {
    expect(getChaveGira({ gira_data: valor })).toBe(chave)
    expect(Number.isNaN(getDataGira({ gira_data: valor }).getTime())).toBe(false)
  })

  test('ignora valor inválido sem derrubar a tela', () => {
    expect(getDataGira({ gira_data: 'data-invalida' })).toBeNull()
    expect(getChaveGira({ gira_data: 'data-invalida' })).toBeNull()
  })
})

import { CabecalhoPagina, Vazio } from '@/components/ui'

export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} />
      <Vazio
        titulo="Módulo em construção"
        descricao="Esta tela entra nas próximas etapas do sistema. O banco já está pronto para ela."
      />
    </>
  )
}

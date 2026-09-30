// Prepara a foto da peça ANTES de subir pro Storage.
//
// POR QUE EXISTE
//   Até 02/08/2026 o ERP subia o arquivo cru do celular. O acervo chegou a
//   346 fotos / 728 MB, média 2,1 MB, maior com 6,2 MB e 4080 × 5440 px —
//   pra aparecer num card de ~390 px. As fotos existentes foram reprocessadas
//   por `scripts/converter-fotos.py`, mas sem este passo aqui cada peça nova
//   voltava a entrar com 2 MB e o problema se refazia sozinho.
//
// A REGRA (a mesma do script, pro acervo ficar homogêneo)
//   JPEG qualidade 88, teto de 2000 px no lado maior. Numa PNG de 1086 px só
//   troca o formato; numa JPEG de 4080 px reduz e reencoda. 2000 px aguenta
//   4,3× de zoom no modal do site (que exibe a 461 px), então sobra folga
//   pra uma lupa no futuro sem precisar do arquivo original.
//
// ⚠️ ORIENTAÇÃO EXIF
//   Foto de celular quase sempre vem com a rotação no EXIF, não nos pixels.
//   Quem desenha no canvas ignorando isso sobe a peça deitada. Por isso o
//   `imageOrientation: 'from-image'` no createImageBitmap — é ele que aplica
//   a rotação antes de desenhar. Sem essa linha o bug aparece só em algumas
//   fotos, o que é pior do que aparecer em todas.
//
// SEMPRE DEGRADA PRO ORIGINAL
//   Se o navegador não souber decodificar (HEIC do iPhone é o caso comum),
//   ou se o resultado não ficar menor, devolve o arquivo como veio. Nunca
//   impede o cadastro da peça por causa da compressão.

const LADO_MAX = 2000
const QUALIDADE = 0.88
// Só troca se a versão nova couber em 90% do original. Abaixo disso o ganho
// não paga reencodar — há foto que já chega otimizada.
const GANHO_MINIMO = 0.9

export async function prepararFoto(arquivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

    const maior = Math.max(bitmap.width, bitmap.height)
    const escala = maior > LADO_MAX ? LADO_MAX / maior : 1
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return arquivo
    // Fundo branco: JPEG não tem transparência, e PNG com fundo transparente
    // viraria preto sem isto.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()

    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, 'image/jpeg', QUALIDADE),
    )
    if (!blob || blob.size > arquivo.size * GANHO_MINIMO) return arquivo

    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Formato que o navegador não abre (HEIC, TIFF...). Sobe como veio.
    return arquivo
  }
}

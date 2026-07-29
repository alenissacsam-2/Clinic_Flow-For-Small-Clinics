import "server-only"
import { renderToBuffer } from "@react-pdf/renderer"
import { RxDocument, type RxData } from "./rx-document"

export async function renderRxToBuffer(data: RxData): Promise<Buffer> {
  return renderToBuffer(<RxDocument data={data} />)
}

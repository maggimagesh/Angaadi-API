import { createReadStream } from 'fs'
import type { Writable } from 'stream'
import zlib from 'zlib'

export type ZipEntrySource =
  | { kind: 'buffer'; data: Buffer }
  | { kind: 'file'; path: string }

export interface ZipStreamEntry {
  name: string
  sizeBytes: number
  modifiedAt: Date
  source: ZipEntrySource
}

const ZIP64_LIMIT = 0xffffffff
const MAX_CLASSIC_ENTRIES = 0xffff
const LOCAL_HEADER_BASE = 30
const CENTRAL_HEADER_BASE = 46
const EOCD_SIZE = 22
const ZIP64_EOCD_SIZE = 56
const ZIP64_LOCATOR_SIZE = 20
const FILE_READ_HIGH_WATER_MARK = 1024 * 1024

const nativeCrc32 = (
  zlib as unknown as { crc32?: (data: NodeJS.ArrayBufferView, value?: number) => number }
).crc32

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function updateCrc32(previous: number, chunk: Buffer): number {
  if (nativeCrc32) {
    return nativeCrc32(chunk, previous) >>> 0
  }
  let crc = (previous ^ 0xffffffff) >>> 0
  for (let i = 0; i < chunk.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f)
  const dosDate =
    (((Math.max(date.getFullYear(), 1980) - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f)
  return { dosTime, dosDate }
}

interface EntryLayout {
  entry: ZipStreamEntry
  nameBytes: Buffer
  dosTime: number
  dosDate: number
  zip64Sizes: boolean
  zip64Offset: boolean
  localOffset: number
  crc: number
}

export interface ZipStreamPlan {
  layouts: EntryLayout[]
  centralOffset: number
  centralSize: number
  useZip64Eocd: boolean
  totalSizeBytes: number
}

function dataDescriptorLength(layout: EntryLayout): number {
  return layout.zip64Sizes ? 24 : 16
}

function centralExtraLength(layout: EntryLayout): number {
  const fieldBytes = (layout.zip64Sizes ? 16 : 0) + (layout.zip64Offset ? 8 : 0)
  return fieldBytes > 0 ? 4 + fieldBytes : 0
}

export function planZipStream(entries: ZipStreamEntry[]): ZipStreamPlan {
  let offset = 0
  const layouts: EntryLayout[] = entries.map((entry) => {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const { dosTime, dosDate } = dosDateTime(entry.modifiedAt)
    const zip64Sizes = entry.sizeBytes >= ZIP64_LIMIT
    const layout: EntryLayout = {
      entry,
      nameBytes,
      dosTime,
      dosDate,
      zip64Sizes,
      zip64Offset: offset >= ZIP64_LIMIT,
      localOffset: offset,
      crc: 0,
    }
    const localHeaderLength = LOCAL_HEADER_BASE + nameBytes.length + (zip64Sizes ? 20 : 0)
    offset += localHeaderLength + entry.sizeBytes + dataDescriptorLength(layout)
    return layout
  })

  const centralOffset = offset
  let centralSize = 0
  for (const layout of layouts) {
    centralSize += CENTRAL_HEADER_BASE + layout.nameBytes.length + centralExtraLength(layout)
  }

  const useZip64Eocd =
    layouts.length > MAX_CLASSIC_ENTRIES ||
    centralOffset >= ZIP64_LIMIT ||
    centralSize >= ZIP64_LIMIT

  const totalSizeBytes =
    centralOffset +
    centralSize +
    (useZip64Eocd ? ZIP64_EOCD_SIZE + ZIP64_LOCATOR_SIZE : 0) +
    EOCD_SIZE

  return { layouts, centralOffset, centralSize, useZip64Eocd, totalSizeBytes }
}

function buildLocalHeader(layout: EntryLayout): Buffer {
  const extraLength = layout.zip64Sizes ? 20 : 0
  const header = Buffer.alloc(LOCAL_HEADER_BASE + layout.nameBytes.length + extraLength)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(layout.zip64Sizes ? 45 : 20, 4)
  // bit 3: sizes/crc follow in a data descriptor; bit 11: UTF-8 file name
  header.writeUInt16LE(0x0808, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(layout.dosTime, 10)
  header.writeUInt16LE(layout.dosDate, 12)
  header.writeUInt32LE(0, 14)
  header.writeUInt32LE(layout.zip64Sizes ? ZIP64_LIMIT : 0, 18)
  header.writeUInt32LE(layout.zip64Sizes ? ZIP64_LIMIT : 0, 22)
  header.writeUInt16LE(layout.nameBytes.length, 26)
  header.writeUInt16LE(extraLength, 28)
  layout.nameBytes.copy(header, LOCAL_HEADER_BASE)
  if (layout.zip64Sizes) {
    const extraOffset = LOCAL_HEADER_BASE + layout.nameBytes.length
    header.writeUInt16LE(0x0001, extraOffset)
    header.writeUInt16LE(16, extraOffset + 2)
    header.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), extraOffset + 4)
    header.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), extraOffset + 12)
  }
  return header
}

function buildDataDescriptor(layout: EntryLayout): Buffer {
  const descriptor = Buffer.alloc(dataDescriptorLength(layout))
  descriptor.writeUInt32LE(0x08074b50, 0)
  descriptor.writeUInt32LE(layout.crc, 4)
  if (layout.zip64Sizes) {
    descriptor.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), 8)
    descriptor.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), 16)
  } else {
    descriptor.writeUInt32LE(layout.entry.sizeBytes, 8)
    descriptor.writeUInt32LE(layout.entry.sizeBytes, 12)
  }
  return descriptor
}

function buildCentralHeader(layout: EntryLayout): Buffer {
  const extraLength = centralExtraLength(layout)
  const header = Buffer.alloc(CENTRAL_HEADER_BASE + layout.nameBytes.length + extraLength)
  const needsZip64 = layout.zip64Sizes || layout.zip64Offset
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(45, 4)
  header.writeUInt16LE(needsZip64 ? 45 : 20, 6)
  header.writeUInt16LE(0x0808, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(layout.dosTime, 12)
  header.writeUInt16LE(layout.dosDate, 14)
  header.writeUInt32LE(layout.crc, 16)
  header.writeUInt32LE(layout.zip64Sizes ? ZIP64_LIMIT : layout.entry.sizeBytes, 20)
  header.writeUInt32LE(layout.zip64Sizes ? ZIP64_LIMIT : layout.entry.sizeBytes, 24)
  header.writeUInt16LE(layout.nameBytes.length, 28)
  header.writeUInt16LE(extraLength, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(layout.zip64Offset ? ZIP64_LIMIT : layout.localOffset, 42)
  layout.nameBytes.copy(header, CENTRAL_HEADER_BASE)
  if (extraLength > 0) {
    let cursor = CENTRAL_HEADER_BASE + layout.nameBytes.length
    header.writeUInt16LE(0x0001, cursor)
    header.writeUInt16LE(extraLength - 4, cursor + 2)
    cursor += 4
    if (layout.zip64Sizes) {
      header.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), cursor)
      header.writeBigUInt64LE(BigInt(layout.entry.sizeBytes), cursor + 8)
      cursor += 16
    }
    if (layout.zip64Offset) {
      header.writeBigUInt64LE(BigInt(layout.localOffset), cursor)
    }
  }
  return header
}

function buildEndOfArchive(plan: ZipStreamPlan): Buffer {
  const parts: Buffer[] = []

  if (plan.useZip64Eocd) {
    const zip64Eocd = Buffer.alloc(ZIP64_EOCD_SIZE)
    zip64Eocd.writeUInt32LE(0x06064b50, 0)
    zip64Eocd.writeBigUInt64LE(BigInt(ZIP64_EOCD_SIZE - 12), 4)
    zip64Eocd.writeUInt16LE(45, 12)
    zip64Eocd.writeUInt16LE(45, 14)
    zip64Eocd.writeUInt32LE(0, 16)
    zip64Eocd.writeUInt32LE(0, 20)
    zip64Eocd.writeBigUInt64LE(BigInt(plan.layouts.length), 24)
    zip64Eocd.writeBigUInt64LE(BigInt(plan.layouts.length), 32)
    zip64Eocd.writeBigUInt64LE(BigInt(plan.centralSize), 40)
    zip64Eocd.writeBigUInt64LE(BigInt(plan.centralOffset), 48)
    parts.push(zip64Eocd)

    const locator = Buffer.alloc(ZIP64_LOCATOR_SIZE)
    locator.writeUInt32LE(0x07064b50, 0)
    locator.writeUInt32LE(0, 4)
    locator.writeBigUInt64LE(BigInt(plan.centralOffset + plan.centralSize), 8)
    locator.writeUInt32LE(1, 16)
    parts.push(locator)
  }

  const eocd = Buffer.alloc(EOCD_SIZE)
  const entryCount = Math.min(plan.layouts.length, MAX_CLASSIC_ENTRIES)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entryCount, 8)
  eocd.writeUInt16LE(entryCount, 10)
  eocd.writeUInt32LE(plan.centralSize >= ZIP64_LIMIT ? ZIP64_LIMIT : plan.centralSize, 12)
  eocd.writeUInt32LE(plan.centralOffset >= ZIP64_LIMIT ? ZIP64_LIMIT : plan.centralOffset, 16)
  eocd.writeUInt16LE(0, 20)
  parts.push(eocd)

  return Buffer.concat(parts)
}

function createBackpressuredWriter(out: Writable): (chunk: Buffer) => Promise<void> {
  let closed = false
  out.once('close', () => {
    closed = true
  })

  return async (chunk: Buffer) => {
    if (closed || out.destroyed) {
      throw new Error('Zip output stream closed before archive was complete')
    }
    if (out.write(chunk)) {
      return
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        out.off('drain', onDrain)
        out.off('close', onClose)
        out.off('error', onError)
      }
      const onDrain = () => {
        cleanup()
        resolve()
      }
      const onClose = () => {
        cleanup()
        reject(new Error('Zip output stream closed before archive was complete'))
      }
      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }
      out.once('drain', onDrain)
      out.once('close', onClose)
      out.once('error', onError)
    })
  }
}

async function streamEntryData(
  layout: EntryLayout,
  write: (chunk: Buffer) => Promise<void>
): Promise<void> {
  const { source, sizeBytes, name } = layout.entry

  if (source.kind === 'buffer') {
    layout.crc = updateCrc32(0, source.data)
    if (source.data.length !== sizeBytes) {
      throw new Error(`Zip entry "${name}" size mismatch`)
    }
    if (source.data.length > 0) {
      await write(source.data)
    }
    return
  }

  let crc = 0
  let bytesRead = 0
  const stream = createReadStream(source.path, { highWaterMark: FILE_READ_HIGH_WATER_MARK })
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      crc = updateCrc32(crc, buffer)
      bytesRead += buffer.length
      if (bytesRead > sizeBytes) {
        throw new Error(`Zip entry "${name}" grew while streaming`)
      }
      await write(buffer)
    }
  } finally {
    stream.destroy()
  }
  if (bytesRead !== sizeBytes) {
    throw new Error(`Zip entry "${name}" changed size while streaming`)
  }
  layout.crc = crc
}

export async function streamZip(plan: ZipStreamPlan, out: Writable): Promise<void> {
  const write = createBackpressuredWriter(out)

  for (const layout of plan.layouts) {
    await write(buildLocalHeader(layout))
    await streamEntryData(layout, write)
    await write(buildDataDescriptor(layout))
  }

  for (const layout of plan.layouts) {
    await write(buildCentralHeader(layout))
  }

  await write(buildEndOfArchive(plan))
}

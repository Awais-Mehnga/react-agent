export type MediaItem = {
  id: string
  type: 'image' | 'video'
  url: string
  label: string
  thumb?: string
}

const SAMPLE_IMAGES: MediaItem[] = [
  {
    id: 'img-1',
    type: 'image',
    label: 'Hero landscape',
    url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200&q=60',
  },
  {
    id: 'img-2',
    type: 'image',
    label: 'Workspace',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&q=60',
  },
  {
    id: 'img-3',
    type: 'image',
    label: 'Abstract',
    url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=200&q=60',
  },
]

const SAMPLE_VIDEOS: MediaItem[] = [
  {
    id: 'vid-1',
    type: 'video',
    label: 'Sample clip',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumb: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&q=60',
  },
]

const uploaded: MediaItem[] = []

/** Prototype media boundary — swap for Laravel upload API later. */
export async function listMedia(type?: 'image' | 'video'): Promise<MediaItem[]> {
  const all = [...SAMPLE_IMAGES, ...SAMPLE_VIDEOS, ...uploaded]
  return type ? all.filter((m) => m.type === type) : all
}

export async function uploadMedia(file: File): Promise<MediaItem> {
  const isVideo = file.type.startsWith('video/')
  const url = URL.createObjectURL(file)
  const item: MediaItem = {
    id: `upload-${Date.now()}`,
    type: isVideo ? 'video' : 'image',
    url,
    label: file.name,
    thumb: isVideo ? undefined : url,
  }
  uploaded.unshift(item)
  return item
}

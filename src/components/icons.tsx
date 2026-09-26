import type { SVGProps } from 'react'

const base = (d: React.ReactNode) => (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>{d}</svg>
)

export const IconFlag = base(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>)
export const IconTarget = base(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>)
export const IconLayers = base(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>)
export const IconExport = base(<><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>)
export const IconPlay = base(<path d="M7 4v16l13-8L7 4Z" fill="currentColor" />)
export const IconStop = base(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />)
export const IconBack = base(<path d="m15 18-6-6 6-6" />)
export const IconUp = base(<path d="m6 15 6-6 6 6" />)
export const IconDown = base(<path d="m6 9 6 6 6-6" />)
export const IconPlus = base(<><path d="M12 5v14M5 12h14" /></>)
export const IconTrash = base(<><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>)
export const IconMusic = base(<><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>)
export const IconVideo = base(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>)
export const IconBall = base(<><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10l4-3Z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" /></>)
export const IconGlove = base(<><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.5L7 14" /></>)
export const IconSpark = base(<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z" fill="currentColor" />)
export const IconShare = base(<><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>)
export const IconRewind = base(<><path d="M11 17 6 12l5-5" /><path d="M18 17l-5-5 5-5" /></>)
export const IconForward = base(<><path d="m13 17 5-5-5-5" /><path d="m6 17 5-5-5-5" /></>)
export const IconPhoto = base(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>)
export const IconCheck = base(<path d="m5 12 5 5 9-10" />)
export const IconSaveVideo = base(<><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 20h14" /></>)

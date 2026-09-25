/**
 * Ambient media used across the product. All entries are hotlinked and easy to swap.
 *  - Videos: supplied by the client (CloudFront). Replace with the school's own footage for production.
 *  - Photos: Unsplash (free licence, hotlinking permitted). IDs verified reachable on 24 Sep 2026.
 * Every use has a gradient fallback so the page still reads if a URL stops resolving.
 */
const FLOW = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260815_034306_165449ef-7d2e-4e81-850f-1939c5cb442d.mp4'
const HANDS = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4'

export const VIDEO = {
  /** Hero and closing use the flowing abstract clip. The reference clip (a human hand and a robotic hand) is kept as `hands` if wanted. */
  hero: FLOW,
  story: FLOW,
  hands: HANDS,
}

const u = (id: string, w = 1600, h?: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=72`

export const IMG = {
  appleBooks: u('1503676260728-1c00da094a0b'),
  bookStack: '/media/books.jpg',
  libraryCurve: u('1524995997946-a1c2e315a42f'),
  classroomTeacher: '/media/classroom.jpg',
  libraryAisle: u('1427504494785-3a9ca7044f45'),
  emptyClassroom: '/media/school.jpg',
  loveToLearn: u('1546410531-bb4caa6b424d'),
  deskLaptop: u('1488190211105-8b0e65b80b4e'),
  classroomKids: u('1577896851231-70ef18881754'),
  kidsDesks: u('1588072432836-e10032774350'),
  students: u('1571260899304-425eee4c7efc'),
}

export const ASSET_SOURCES = [
  { name: 'Unsplash', url: 'https://unsplash.com', use: 'Photography (free licence, hotlinking allowed)' },
  { name: 'Pexels', url: 'https://www.pexels.com/videos/', use: 'Free stock video for ambient backgrounds' },
  { name: 'Spline', url: 'https://spline.design', use: 'Interactive 3D orbs and objects, embeddable in React' },
  { name: '3dicons', url: 'https://3dicons.co', use: 'Free CC0 3D icon pack (PNG, Blender source)' },
  { name: 'Icons8 3D', url: 'https://icons8.com/icons/3d', use: '3D icon sets in several styles' },
  { name: 'LottieFiles', url: 'https://lottiefiles.com', use: 'Vector animations for empty states and success moments' },
  { name: 'Rive', url: 'https://rive.app', use: 'State-machine driven interactive animation' },
  { name: 'Haikei', url: 'https://haikei.app', use: 'Generated SVG blob and mesh backgrounds' },
  { name: 'Coolors mesh', url: 'https://coolors.co/gradient-maker', use: 'Mesh gradient generator' },
]

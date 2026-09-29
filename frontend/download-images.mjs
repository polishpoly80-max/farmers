import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.join(root, 'public', 'images')
const userAgent = 'PremiumPoultryFarm/1.0 (local website asset download; contact: local-development@example.invalid)'

const sourceFiles = {
  'free-range-chickens': 'Free range chickens in pasture - geograph.org.uk - 1132932.jpg',
  'chicken-pasture': '20160521-RD-LSC-0422 (27438400130).jpg',
  'chicken-pasture-2': '20160521-RD-LSC-0980 (27716486095).jpg',
  'chicken-pasture-3': '20160521-RD-LSC-0987 (27682519486).jpg',
  'eggs-basket': 'Eggs in basket 2020 G1.jpg',
  'chicken-eggs': '6-Pack-Chicken-Eggs.jpg',
  'brown-eggs': 'Brown chicken eggs (1).jpg',
  'quail-eggs': 'Quail eggs, Rostov-on-Don, Russia.jpg',
  'farm-duck': 'Brown domestic duck with orange beak in a pond at golden hour in Don Det Laos.jpg',
  'smoked-duck': 'Lightly smoked breast of duck (11484824346).jpg',
  'farm-turkey': 'Strutting Turkey.jpg',
  'chicken-wings': 'Chicken wings for lunch.jpg',
}

const appImages = {
  'hero-chickens.jpg': 'free-range-chickens',
  'about-farm.jpg': 'chicken-pasture',
  'about-hens.jpg': 'chicken-pasture-2',
  'about-chicken.jpg': 'free-range-chickens',
  'about-turkey.jpg': 'farm-turkey',
  'farm-chicken.jpg': 'chicken-pasture',
  'farm-eggs.jpg': 'chicken-eggs',
  'farm-duck.jpg': 'farm-duck',
  'farm-turkey.jpg': 'farm-turkey',
  'chicken-wings.jpg': 'chicken-wings',
  'smoked-duck-breast.jpg': 'smoked-duck',
  'organic-layer-hen.jpg': 'chicken-pasture-3',
  'free-range-chicken.jpg': 'free-range-chickens',
  'quail-eggs.jpg': 'quail-eggs',
  'brown-eggs-12.jpg': 'brown-eggs',
  'category-chicken.jpg': 'free-range-chickens',
  'category-eggs.jpg': 'eggs-basket',
  'category-duck.jpg': 'farm-duck',
  'category-turkey.jpg': 'farm-turkey',
  'cart-eggs.jpg': 'eggs-basket',
  'cart-chicken-wings.jpg': 'chicken-wings',
}

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds))

function plainText(value = '') {
  return value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()
}

async function fetchCommonsMetadata() {
  const params = new URLSearchParams({
    action: 'query',
    titles: Object.values(sourceFiles).map(title => `File:${title}`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url|thumburl|extmetadata',
    iiurlwidth: '1000',
    format: 'json',
    origin: '*',
  })

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': userAgent },
  })
  if (!response.ok) throw new Error(`Commons API returned ${response.status}`)
  return response.json()
}

async function download(sourceUrl, destination) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'User-Agent': userAgent },
        redirect: 'follow',
        signal: AbortSignal.timeout(45000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await writeFile(destination, Buffer.from(await response.arrayBuffer()))
      return
    } catch (error) {
      if (attempt === 3) throw error
      await wait(attempt * 3000)
    }
  }
}

const metadata = await fetchCommonsMetadata()
const pages = Object.values(metadata.query.pages)
const imageInfoByTitle = new Map()

for (const page of pages) {
  const title = page.title.replace(/^File:/, '')
  const imageInfo = page.imageinfo?.[0]
  if (imageInfo) imageInfoByTitle.set(title, imageInfo)
}

await mkdir(outputDirectory, { recursive: true })
const downloaded = new Map()
const credits = [
  '# Image credits',
  '',
  'The poultry photos bundled with this project are downloaded from Wikimedia Commons.',
  'Each source page contains its author and license information.',
  '',
]

for (const [key, title] of Object.entries(sourceFiles)) {
  const info = imageInfoByTitle.get(title)
  if (!info?.thumburl && !info?.url) throw new Error(`No Commons download URL found for ${title}`)

  const sourcePath = path.join(outputDirectory, `source-${key}.jpg`)
  await download(info.thumburl || info.url, sourcePath)
  downloaded.set(key, sourcePath)

  const metadataValue = info.extmetadata ?? {}
  credits.push(
    `- **${title}** — ${plainText(metadataValue.Artist?.value) || 'See source page for author'}; ${plainText(metadataValue.LicenseShortName?.value) || 'See source page for license'}. [Source](${info.descriptionurl})`,
  )
  console.log(`Downloaded source: ${key}`)
  await wait(1200)
}

for (const [filename, key] of Object.entries(appImages)) {
  await copyFile(downloaded.get(key), path.join(outputDirectory, filename))
}

await writeFile(path.join(outputDirectory, 'ATTRIBUTION.md'), `${credits.join('\n')}\n`)
console.log(`Created ${Object.keys(appImages).length} local application images.`)

import {readdirSync, statSync} from 'node:fs'
import rimraf from 'rimraf'

const dir = 'content/data/pages'

for (const sub of readdirSync(dir)) {
  const location = dir + '/' + sub
  if (statSync(location).isDirectory()) rimraf.sync(location)
}

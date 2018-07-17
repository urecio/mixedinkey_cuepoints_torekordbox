const parser = require('xml2json');
fs = require('fs');
const mm = require('music-metadata');
const getAllFiles = require('./reader');

require('dotenv').config()

let tracks = [];

const updateCollectionTracksWithCuesFromMixedInKey = async (col, filesInDirectory) => {

  // count of files in collection vs files matched in directory
  let countMatches = 0;
  let countFilesInDir = 0;
  let missingFilesInCollectionXml = [];
  const filesFormat = process.env.FILES_FORMAT;

  await Promise.all(filesInDirectory.map(async (f) => {
    countFilesInDir++;
    let hasBeenMatched = false;

    // mapping tracks on collection
    const moreTracks = await Promise.all(col['DJ_PLAYLISTS'].COLLECTION.TRACK.map(async (t) => {

      const nameFromLocation = t.Location.substring(t.Location.lastIndexOf('/') + 1, t.Location.length - `.${filesFormat}`.length)
        .replace(new RegExp('%20', 'g'), ' ')
        .replace(new RegExp('%26', 'g'), '&')
        .replace(new RegExp('%27', 'g'), "'")
        .replace(new RegExp('%26', 'g'), '&')

      const nameFromFileInDir = f.substring(f.lastIndexOf('/') + 1, f.length - `.${filesFormat}`.length)

      if (nameFromLocation === nameFromFileInDir) {
        countMatches++;
        hasBeenMatched = true;

        // giving the right shape to the POSITION_MARK
        if (!t.POSITION_MARK) {
          t.POSITION_MARK = [];
        } else if (t.POSITION_MARK.Type) { // is an object, creating an array instead...
          t.POSITION_MARK = [t.POSITION_MARK];
        }

        // Clearing existing stuff (we just leave the type "cue")
        t.POSITION_MARK = t.POSITION_MARK.filter((cueP) => cueP.Type !== '0');

        // adding cue points from mixed in key
        const metadata = await mm.parseFile(f, {
          native: true
        });
        const cuePointsEnc = metadata.native['ID3v2.4'].filter((idNode) => idNode.id === 'GEOB' && idNode.value.description === 'uePoints');
        const cueDataStream = cuePointsEnc[0].value.data;
        const cueBase64 = cueDataStream.toString('ascii').replace('uePoints', '');
        const cuePoints = JSON.parse(Buffer.from(cueBase64, 'base64').toString('ascii')).cues;

        // only the first 2 and the last 2... cdjs, ya know...
        const filteredCuePoints = cuePoints.filter((c, i) => [3, 4, 5].indexOf(i) === -1);

        // mapping cue points with the right format for rekordbox
        t.POSITION_MARK = t.POSITION_MARK.concat(filteredCuePoints.map((c, i) => {
          return {
            Name: c.name,
            Start: (c.time / 1000) + .05,
            Type: 0,
            Num: i - 1
          };
        }));

        return t;

      }

    }));

    tracks = tracks.concat(moreTracks);

    if (!hasBeenMatched) missingFilesInCollectionXml.push(f);

  }));

  // this 2 should be the same
  console.log('countMatches', countMatches);
  console.log('count files in dir', countFilesInDir);
  console.log('missing files in collection xml: ', missingFilesInCollectionXml.join(','));

};


const run = async () => {

  // config reading...
  const baseDir =  process.env.DIR;

  // reading collection...
  const xml = fs.readFileSync('./collection.xml');
  const col = JSON.parse(parser.toJson(xml));

  const files = getAllFiles(baseDir).filter((f) => f.indexOf('/._') === -1);
  await updateCollectionTracksWithCuesFromMixedInKey(col, files);

  col['DJ_PLAYLISTS'].COLLECTION.TRACK = tracks.filter(t => t);
  
  fs.writeFileSync('./newrekordbox.xml', parser.toXml(JSON.stringify(col), { sanitize: true }));

};

run();

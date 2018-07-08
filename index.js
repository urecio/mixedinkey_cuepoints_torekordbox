const parser = require('xml2json');
fs = require('fs');
var mm = require('music-metadata');
const util = require('util');
const jwt = require('jsonwebtoken');

const xml = fs.readFileSync('./collection.xml');
const col = JSON.parse(parser.toJson(xml));

const run = async () => {

  // TODO: change dir!
  const baseDir = '/Volumes/U/factory/PN/1PN/';


  const filesInDirectory = fs.readdirSync(baseDir);
  let countMatches = 0;
  let countFilesInDir = 0;

  await Promise.all(filesInDirectory.map(async (f) => {
    countFilesInDir++;
    
    col['DJ_PLAYLISTS'].COLLECTION.TRACK = await Promise.all(col['DJ_PLAYLISTS'].COLLECTION.TRACK.map(async (t) => {

      const nameFromLocation = t.Location.substring(t.Location.lastIndexOf('/') + 1, t.Location.length - '.mp3'.length).replace(new RegExp('%20', 'g'), ' ');

      if (nameFromLocation === f.replace('.mp3', '')) {
        countMatches++;

        if (!t.POSITION_MARK) {
          t.POSITION_MARK = [];
        } else if (t.POSITION_MARK.Type) { // is an object, we create the array
          t.POSITION_MARK = [t.POSITION_MARK];
        }

        t.POSITION_MARK = t.POSITION_MARK.filter((cueP) => cueP.Type !== '0');

        // adding cue points from mixed in key
        const metadata = await mm.parseFile(`${baseDir}${f}`, {
          native: true
        });
        const cuePointsEnc = metadata.native['ID3v2.4'].filter((idNode) => idNode.id === 'GEOB' && idNode.value.description === 'uePoints');
        const offsets = metadata.native['ID3v2.4'].filter((idNode) => idNode.id === 'GEOB' && idNode.value.description.indexOf('Offsets') !== -1);
        const cueDataStream = cuePointsEnc[0].value.data;
        const cueJwt = cueDataStream.toString('ascii').replace('uePoints', '');
        const cuePoints = JSON.parse(Buffer.from(cueJwt, 'base64').toString('ascii')).cues;
        const filteredCuePoints = cuePoints.filter((c, i) => [3,4,5].indexOf(i) === -1);
        t.POSITION_MARK = t.POSITION_MARK.concat(filteredCuePoints.map((c, i) => {
          return {
            Name: c.name,
            Start: (c.time / 1000) + .05,
            Type: 0,
            Num: i - 1
          };
        }));

      }

      return t;

    }));    
          
  }));
        
  console.log('countMatches', countMatches);
  console.log('count files in dir', countFilesInDir);

  fs.writeFileSync('./newrekordbox.xml', parser.toXml(JSON.stringify(col)));

};

run();

## Needs:
- collection.xml (exported from rekordbox)
- newrekordbox.xml (will get overwritten by the script)

## How to run:
- export rekordbox collection and paste it here
- yarn
- Write cue metadata with Mixed in key 
- change baseDir to the dir with the tracks
- `node index.js`
- copy new xml to rekordbox.xml and put it in Library/Pioneer/rekordbox.xml
- On rekordbox, move songs from rekordbox.xml/collection to the main window and their db will get updated

Enjoy!
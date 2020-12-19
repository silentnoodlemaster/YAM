To use the V8 snapshot add a new enviroment variable for the user:
 + Name: ELECTRON_CUSTOM_VERSION 
 + Value: Version of Electron (i.e. 11.1.0)

Run `snapshot` and from the `cache` folder copy `snapshot_blob.bin` and `v8_context_snapshot.bin` to `node_modules\electron\dist` (overwrite the files).

If a "Version mismatch" error appears, download the mksnapshot binaries from the electron release, as explained [here](https://github.com/electron/mksnapshot/issues/29).

More information on [Medium](https://blog.inkdrop.info/how-to-make-your-electron-app-launch-1000ms-faster-32ce1e0bb52c)